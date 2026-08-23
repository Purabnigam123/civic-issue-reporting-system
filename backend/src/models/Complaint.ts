import mongoose, { Schema, Document } from 'mongoose';

export enum ComplaintStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  REOPENED = 'REOPENED',
}

export enum ComplaintCategory {
  POTHOLE = 'pothole',
  BROKEN_STREETLIGHT = 'broken_streetlight',
  GARBAGE = 'garbage',
  DRAINAGE = 'drainage',
  WATER_ISSUE = 'water_issue',
  PUBLIC_PROPERTY = 'public_property',
  ROAD_DAMAGE = 'road_damage',
  OTHER = 'other',
}

export enum ComplaintPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface IComplaint extends Document {
  complaintId: string;
  citizenId: mongoose.Types.ObjectId;
  category: ComplaintCategory;
  description: string;
  images: string[];
  voiceNote?: string;
  latitude: number;
  longitude: number;
  address: string;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  department: string;
  createdAt: Date;
  updatedAt: Date;
}

const complaintSchema = new Schema<IComplaint>(
  {
    complaintId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    citizenId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(ComplaintCategory),
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    images: {
      type: [String],
      default: [],
    },
    voiceNote: {
      type: String,
      default: null,
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(ComplaintStatus),
      default: ComplaintStatus.SUBMITTED,
    },
    priority: {
      type: String,
      enum: Object.values(ComplaintPriority),
      default: ComplaintPriority.MEDIUM,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IComplaint>('Complaint', complaintSchema);
