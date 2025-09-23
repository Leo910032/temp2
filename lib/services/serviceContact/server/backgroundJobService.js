// //// /////////////////////////////////////////////////////////////////////////////////////////////////////////////

// NEW FILE: lib/services/serviceContact/server/backgroundJobService.js
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { GeminiGroupingEnhancer } from './geminiGroupingEnhancer';
import { AutoGroupService } from './autoGroupService';

export class BackgroundJobService {
  /**
   * Starts the AI group generation job.
   * Creates the initial job record and kicks off the async process.
   */
  static async startAIGroupingJob(userId, options) {
    console.log(`[JobService] Starting AI grouping job for user: ${userId}`);
    
    const jobId = `ai_grouping_${userId}_${Date.now()}`;
    const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
    
    await jobRef.set({
      id: jobId,
      userId,
      type: 'ai_group_generation',
      status: 'queued',
      progress: 0,
      options,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      estimatedDuration: 120000, // 2 minutes estimate
      stages: [
        { name: 'Fetching Contacts', status: 'pending', progress: 0 },
        { name: 'AI Analysis', status: 'pending', progress: 0 },
        { name: 'Deduplicating Groups', status: 'pending', progress: 0 },
        { name: 'Saving Results', status: 'pending', progress: 0 }
      ]
    });

    // IMPORTANT: Start the long-running process but DO NOT await it.
    this.processAIGroupingAsync(userId, jobId, options).catch(error => {
      console.error(`🔴 Background job ${jobId} failed catastrophically:`, error);
      jobRef.update({
        status: 'failed',
        error: error.message || 'An unknown error occurred during background processing.',
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    return { jobId, estimatedDuration: 120000 };
  }

  /**
   * Retrieves the status of a specific job, ensuring the user has permission.
   */
  static async getJobStatus(userId, jobId) {
    console.log(`[JobService] Getting status for job: ${jobId}`);
    
    if (!jobId) {
      throw new Error('Job ID is required');
    }

    const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      throw new Error('Job not found');
    }

    const jobData = jobDoc.data();

    // Security Check: Ensure the user requesting the status owns the job
    if (jobData.userId !== userId) {
      throw new Error('Permission denied');
    }

    return jobData;
  }

  /**
   * The actual background worker function. It runs on the server
   * after the API has already responded.
   */
  static async processAIGroupingAsync(userId, jobId, options) {
    const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
    
    try {
      // --- STAGE 1: Fetching Contacts ---
      await jobRef.update({ status: 'processing', progress: 5, 'stages.0.status': 'in_progress', updatedAt: FieldValue.serverTimestamp() });
      const contactsDoc = await adminDb.collection('Contacts').doc(userId).get();
      if (!contactsDoc.exists) throw new Error('No contacts document found for user.');
      const contacts = contactsDoc.data().contacts || [];
      console.log(`[${jobId}] Fetched ${contacts.length} contacts`);

      if (contacts.length < 5) {
        await jobRef.update({ status: 'completed', progress: 100, result: { groups: [], message: 'Not enough contacts to process.' }, completedAt: FieldValue.serverTimestamp() });
        return;
      }

      await jobRef.update({ progress: 15, 'stages.0.status': 'completed', 'stages.0.progress': 100, 'stages.1.status': 'in_progress', updatedAt: FieldValue.serverTimestamp() });

      // --- STAGE 2: AI Analysis ---
      let allGroups = [];
      try {
        const result = await Promise.race([
          GeminiGroupingEnhancer.enhanceGrouping(contacts, 'enterprise', userId), // Pass userId for logging
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI processing timed out.')), 120000))
        ]);
        if (result && result.enhancedGroups) {
            allGroups.push(...result.enhancedGroups);
        }
      } catch (aiError) {
        console.error(`[${jobId}] Error during AI phase:`, aiError);
        await jobRef.update({ 'stageErrors.ai_enhancement': { error: aiError.message, timestamp: FieldValue.serverTimestamp() } });
      }

      // --- STAGE 3: Deduplicating ---
      await jobRef.update({ progress: 85, 'stages.1.status': 'completed', 'stages.1.progress': 100, 'stages.2.status': 'in_progress', updatedAt: FieldValue.serverTimestamp() });
      const uniqueGroups = Array.from(new Map(allGroups.map(g => [g.name.toLowerCase().trim(), g])).values());
      const limitedGroups = uniqueGroups.slice(0, options.maxGroups || 15);

      // --- STAGE 4: Saving ---
      await jobRef.update({ progress: 95, 'stages.2.status': 'completed', 'stages.2.progress': 100, 'stages.3.status': 'in_progress', updatedAt: FieldValue.serverTimestamp() });
      let savedCount = 0;
      if (limitedGroups.length > 0) {
        // Assuming AutoGroupService has a method to save groups
        const saveResult = await AutoGroupService.saveGeneratedGroups(userId, limitedGroups);
        savedCount = saveResult.savedCount;
      }

      // --- FINAL: Complete Job ---
      await jobRef.update({
        status: 'completed',
        progress: 100,
        'stages.3.status': 'completed',
        'stages.3.progress': 100,
        result: { groups: limitedGroups, totalGenerated: allGroups.length, totalUnique: uniqueGroups.length, totalSaved: savedCount },
        completedAt: FieldValue.serverTimestamp()
      });
      console.log(`[${jobId}] ✅ Job completed for user ${userId}.`);

    } catch (error) {
      console.error(`[${jobId}] ❌ Job failed for user ${userId}:`, error);
      await jobRef.update({ status: 'failed', error: error.message, failedAt: FieldValue.serverTimestamp() });
    }
  }
}