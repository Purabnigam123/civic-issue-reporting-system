import { ComplaintCategory, ComplaintPriority } from '../models/Complaint';

// Map categories to responsible departments
export const categoryToDepartment: Record<ComplaintCategory, string> = {
  [ComplaintCategory.POTHOLE]: 'Roads Department',
  [ComplaintCategory.BROKEN_STREETLIGHT]: 'Electrical Department',
  [ComplaintCategory.GARBAGE]: 'Sanitation Department',
  [ComplaintCategory.DRAINAGE]: 'Drainage Department',
  [ComplaintCategory.WATER_ISSUE]: 'Water Supply Department',
  [ComplaintCategory.PUBLIC_PROPERTY]: 'Public Works Department',
  [ComplaintCategory.ROAD_DAMAGE]: 'Roads Department',
  [ComplaintCategory.OTHER]: 'General Administration',
};

// Map categories to default priority
export const categoryToPriority: Record<ComplaintCategory, ComplaintPriority> = {
  [ComplaintCategory.POTHOLE]: ComplaintPriority.MEDIUM,
  [ComplaintCategory.BROKEN_STREETLIGHT]: ComplaintPriority.MEDIUM,
  [ComplaintCategory.GARBAGE]: ComplaintPriority.LOW,
  [ComplaintCategory.DRAINAGE]: ComplaintPriority.HIGH,
  [ComplaintCategory.WATER_ISSUE]: ComplaintPriority.HIGH,
  [ComplaintCategory.PUBLIC_PROPERTY]: ComplaintPriority.MEDIUM,
  [ComplaintCategory.ROAD_DAMAGE]: ComplaintPriority.MEDIUM,
  [ComplaintCategory.OTHER]: ComplaintPriority.LOW,
};

// Category display info
export const categoryInfo: Record<ComplaintCategory, { name: string; description: string }> = {
  [ComplaintCategory.POTHOLE]: { name: 'Pothole', description: 'Road damage and potholes' },
  [ComplaintCategory.BROKEN_STREETLIGHT]: { name: 'Broken Streetlight', description: 'Streetlights that are damaged or not working' },
  [ComplaintCategory.GARBAGE]: { name: 'Garbage / Waste', description: 'Overflowing or uncollected waste' },
  [ComplaintCategory.DRAINAGE]: { name: 'Drainage', description: 'Blocked or damaged drainage' },
  [ComplaintCategory.WATER_ISSUE]: { name: 'Water Issue', description: 'Water leakage or public water problems' },
  [ComplaintCategory.PUBLIC_PROPERTY]: { name: 'Damaged Public Property', description: 'Damaged public infrastructure' },
  [ComplaintCategory.ROAD_DAMAGE]: { name: 'Road Damage', description: 'Road surface damage other than potholes' },
  [ComplaintCategory.OTHER]: { name: 'Other', description: 'Other civic issues' },
};

export const getDepartment = (category: ComplaintCategory): string => {
  return categoryToDepartment[category] || 'General Administration';
};

export const getPriority = (category: ComplaintCategory): ComplaintPriority => {
  return categoryToPriority[category] || ComplaintPriority.MEDIUM;
};
