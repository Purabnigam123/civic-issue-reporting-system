import { Response } from 'express';
import Complaint, { ComplaintCategory } from '../models/Complaint';
import { getNextComplaintId } from '../models/Counter';
import { getDepartment, getPriority } from '../services/complaintService';
import { AuthRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';

export const createComplaint = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const { category, description, latitude, longitude, address } = req.body;

    // Validate category
    if (!Object.values(ComplaintCategory).includes(category as ComplaintCategory)) {
      sendError(res, 'Invalid category.', 400);
      return;
    }

    // Process uploaded files
    const files = req.files as Express.Multer.File[] | undefined;
    const images: string[] = [];
    let voiceNote: string | undefined;

    if (files && files.length > 0) {
      files.forEach((file) => {
        if (file.mimetype.startsWith('audio/')) {
          voiceNote = file.filename;
        } else {
          images.push(file.filename);
        }
      });
    }

    // Generate complaint ID
    const complaintId = await getNextComplaintId();

    // Get department and priority based on category
    const department = getDepartment(category as ComplaintCategory);
    const priority = getPriority(category as ComplaintCategory);

    // Create complaint
    const complaint = await Complaint.create({
      complaintId,
      citizenId: req.user._id,
      category,
      description,
      images,
      voiceNote,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address,
      department,
      priority,
    });

    sendSuccess(
      res,
      {
        complaint: {
          id: complaint._id,
          complaintId: complaint.complaintId,
          category: complaint.category,
          status: complaint.status,
          department: complaint.department,
          priority: complaint.priority,
          createdAt: complaint.createdAt,
        },
      },
      'Complaint submitted successfully',
      201
    );
  } catch (error: any) {
    console.error('Create complaint error:', error);
    sendError(res, 'Failed to submit complaint. Please try again.', 500);
  }
};

export const getMyComplaints = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const complaints = await Complaint.find({ citizenId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    sendSuccess(res, { complaints });
  } catch (error) {
    sendError(res, 'Failed to fetch complaints.', 500);
  }
};

export const getComplaintById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const complaint = await Complaint.findById(req.params.id).lean();

    if (!complaint) {
      sendError(res, 'Complaint not found.', 404);
      return;
    }

    // Verify ownership
    if (complaint.citizenId.toString() !== (req.user._id as any).toString()) {
      sendError(res, 'Access denied. This complaint does not belong to you.', 403);
      return;
    }

    sendSuccess(res, { complaint });
  } catch (error) {
    sendError(res, 'Failed to fetch complaint details.', 500);
  }
};
