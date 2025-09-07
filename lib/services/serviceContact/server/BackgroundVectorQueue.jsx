// lib/services/serviceContact/server/services/BackgroundVectorQueue.js
// Optional: For high-volume applications, implement a proper queue

import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export class BackgroundVectorQueue {
  
  /**
   * Add vector processing job to queue
   */
  static async enqueueVectorJob(userId, contactData, priority = 'normal') {
    const jobStartTime = Date.now();
    
    try {
      const job = {
        id: `vector_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'vector_upsert',
        userId,
        contactData,
        priority, // 'high', 'normal', 'low'
        status: 'queued',
        createdAt: new Date().toISOString(),
        attempts: 0,
        maxAttempts: 3
      };

      await adminDb.collection('VectorJobs').doc(job.id).set(job);
      
      console.log(`📋 Vector job queued: ${job.id} (${Date.now() - jobStartTime}ms)`);
      
      // Immediately try to process if system is available
      this.processNextJob().catch(error => 
        console.error('Background job processing failed:', error)
      );
      
      return job.id;
      
    } catch (error) {
      console.error(`❌ Failed to queue vector job after ${Date.now() - jobStartTime}ms:`, error);
      // Fallback to immediate processing
      return null;
    }
  }

  /**
   * Process queued vector jobs
   */
  static async processNextJob() {
    const processStartTime = Date.now();
    
    try {
      // Get next job by priority and creation time
      const jobsQuery = await adminDb.collection('VectorJobs')
        .where('status', '==', 'queued')
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

      if (jobsQuery.empty) {
        console.log(`📋 No vector jobs in queue (${Date.now() - processStartTime}ms)`);
        return;
      }

      const jobDoc = jobsQuery.docs[0];
      const job = jobDoc.data();
      
      console.log(`🔄 Processing vector job: ${job.id}`);
      
      // Mark as processing
      await jobDoc.ref.update({
        status: 'processing',
        processedAt: new Date().toISOString(),
        attempts: job.attempts + 1
      });

      // Process the vector creation
      const { VectorService } = await import('./VectorService');
      const { ExchangeService } = await import('../exchangeService');
      
      await ExchangeService.updateContactVectorAsync(job.userId, job.contactData);
      
      // Mark as completed
      await jobDoc.ref.update({
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      
      const totalTime = Date.now() - processStartTime;
      console.log(`✅ Vector job completed: ${job.id} (${totalTime}ms)`);

      // Process next job if available
      setTimeout(() => this.processNextJob(), 100);
      
    } catch (error) {
      console.error(`❌ Vector job processing failed after ${Date.now() - processStartTime}ms:`, error);
      
      // Handle job failure
      if (jobDoc) {
        const job = jobDoc.data();
        if (job.attempts >= job.maxAttempts) {
          await jobDoc.ref.update({
            status: 'failed',
            failedAt: new Date().toISOString(),
            error: error.message
          });
        } else {
          await jobDoc.ref.update({
            status: 'queued',
            error: error.message
          });
        }
      }
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats() {
    try {
      const [queued, processing, completed, failed] = await Promise.all([
        adminDb.collection('VectorJobs').where('status', '==', 'queued').count().get(),
        adminDb.collection('VectorJobs').where('status', '==', 'processing').count().get(),
        adminDb.collection('VectorJobs').where('status', '==', 'completed').count().get(),
        adminDb.collection('VectorJobs').where('status', '==', 'failed').count().get()
      ]);

      return {
        queued: queued.data().count,
        processing: processing.data().count,
        completed: completed.data().count,
        failed: failed.data().count
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return null;
    }
  }

  /**
   * Clean up old completed jobs
   */
  static async cleanupOldJobs(daysToKeep = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const oldJobsQuery = adminDb.collection('VectorJobs')
        .where('status', 'in', ['completed', 'failed'])
        .where('completedAt', '<', cutoffDate.toISOString())
        .limit(100);

      const oldJobs = await oldJobsQuery.get();
      
      if (oldJobs.empty) return 0;

      const batch = adminDb.batch();
      oldJobs.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      console.log(`🧹 Cleaned up ${oldJobs.size} old vector jobs`);
      return oldJobs.size;
      
    } catch (error) {
      console.error('Error cleaning up old jobs:', error);
      return 0;
    }
  }
}