// app/dashboard/(dashboard pages)/contacts/components/GroupModalComponents/index.js

// Main modal component
export { default as GroupManagerModal } from './GroupManagerModal';

// Tab components
export { default as OverviewTab } from './OverviewTab';
export { default as GroupsTab } from './GroupsTab';
export { default as CreateGroupTab } from './CreateGroupTab';
export { default as AIGenerateTab } from './AIGenerateTab';
export { default as AIGroupsTab } from './AIGroupsTab';

// Utility components
export { default as GroupCard } from './GroupCard';
export { default as ContactSelector } from './ContactSelector';
export { default as TimeFrameSelector } from './TimeFrameSelector';
export { default as LocationSelector } from './LocationSelector';
export { default as StatsGrid } from './StatsGrid';
export { default as QuickActions } from './QuickActions';
export { default as GroupEditModal } from './GroupEditModal';

// Hooks
export { useFormState } from './hooks/useFormState';
export { useGroupActions } from './hooks/useGroupActions';
export { useAIGeneration } from './hooks/useAIGeneration';