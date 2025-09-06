// Create: app/test-imports.js (temporary file)
"use client"
import { useEffect } from 'react';

// Test the import
import {
  getTeamMembers,
  getTeamInvitations,
  removeTeamMember,
  updateMemberRole,
  inviteTeamMember,
  revokeInvitation
} from '../../../../../lib/services/serviceEnterprise/index.js';

export default function TestImports() {
  useEffect(() => {
    console.log('🧪 Testing imports...');
    console.log('getTeamMembers:', typeof getTeamMembers);
    console.log('getTeamInvitations:', typeof getTeamInvitations);
    console.log('removeTeamMember:', typeof removeTeamMember);
    console.log('updateMemberRole:', typeof updateMemberRole);
    console.log('inviteTeamMember:', typeof inviteTeamMember);
    console.log('revokeInvitation:', typeof revokeInvitation);
    console.log('✅ All imports working!');
  }, []);

  return <div>Check console for import test results</div>;
}
