import { Router } from 'express';
import { createComplaint, getMyComplaints, getComplaintById } from '../controllers/complaintController';
import { protect } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

// All complaint routes require authentication
router.use(protect);

router.post('/', upload.array('files', 5), createComplaint);
router.get('/my', getMyComplaints);
router.get('/:id', getComplaintById);

export default router;
