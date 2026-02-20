import { prisma } from '@/lib/prisma';

/**
 * Determines the access level a viewer has over a target user's data.
 * Returns:
 *  - 'admin'     → full access (admin role)
 *  - 'mentor'    → full access including reports (mentor assigned or same community as mentor)
 *  - 'community' → limited access (calendar, tickers, trade visuals — no reports)
 *  - false       → no access
 */
export async function canViewUser(
  viewerId: string,
  viewerRole: string,
  targetUserId: string,
): Promise<'admin' | 'mentor' | 'community' | false> {
  if (viewerId === targetUserId) return 'admin'; // viewing own data
  if (viewerRole === 'ADMIN') return 'admin';

  // Check direct mentor assignment
  if (viewerRole === 'MENTOR' || viewerRole === 'ADMIN') {
    const assignment = await prisma.mentorAssignment.findFirst({
      where: { mentorId: viewerId, studentId: targetUserId },
    });
    if (assignment) return 'mentor';
  }

  // Get viewer's communities
  const viewerMemberships = await prisma.communityMember.findMany({
    where: { userId: viewerId },
    select: { communityId: true },
  });
  const communityIds = viewerMemberships.map((m) => m.communityId);

  if (communityIds.length === 0) return false;

  // Check if target is in any of the same communities
  const targetMembership = await prisma.communityMember.findFirst({
    where: { userId: targetUserId, communityId: { in: communityIds } },
  });

  if (!targetMembership) return false;

  // If viewer is MENTOR in a shared community, grant mentor-level access only to STUDENT-role targets
  if (viewerRole === 'MENTOR') {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });
    if (targetUser?.role === 'STUDENT') return 'mentor';
  }

  return 'community';
}
