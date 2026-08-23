import mongoose, { Schema, Document } from 'mongoose';

interface ICounter extends Document {
  name: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 10000 },
});

const Counter = mongoose.model<ICounter>('Counter', counterSchema);

export const getNextComplaintId = async (): Promise<string> => {
  const counter = await Counter.findOneAndUpdate(
    { name: 'complaintId' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `CIV-${counter.seq}`;
};

export default Counter;
