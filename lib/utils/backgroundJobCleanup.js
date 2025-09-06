import { adminDb } from '@/lib/firebaseAdmin';

export class BackgroundJobCleanup {
  /**
   * Clean up old completed/failed jobs (run this periodically)
   */
  static async cleanupOldJobs(maxAgeHours = 24) {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    const oldJobsQuery = adminDb
      .collection('BackgroundJobs')
      .where('status', 'in', ['completed', 'failed'])
      .where('updatedAt', '<', cutoffTime)
      .limit(100);
    
    const oldJobsSnapshot = await oldJobsQuery.get();
    
    if (!oldJobsSnapshot.empty) {
      const batch = adminDb.batch();
      
      oldJobsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Cleaned up ${oldJobsSnapshot.size} old background jobs`);
    }
  }

  /**
   * Cancel a running job
   */
  static async cancelJob(jobId, userId) {
    const jobRef = adminDb.collection('BackgroundJobs').doc(jobId);
    const jobDoc = await jobRef.get();
    
    if (!jobDoc.exists) {
      throw new Error('Job not found');
    }
    
    const jobData = jobDoc.data();
    
    if (jobData.userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    if (jobData.status === 'processing') {
      await jobRef.update({
        status: 'cancelled',
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  }

  /**
   * Get user's active jobs
   */
  static async getUserActiveJobs(userId) {
    const activeJobsQuery = adminDb
      .collection('BackgroundJobs')
      .where('userId', '==', userId)
      .where('status', 'in', ['queued', 'processing'])
      .orderBy('createdAt', 'desc');
    
    const snapshot = await activeJobsQuery.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}
