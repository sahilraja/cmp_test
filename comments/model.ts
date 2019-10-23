import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    type: { type: String, trim: true },
    comment: { type: String, trim: true },
    entity_id: { type: String },
    user_id: { type: Schema.Types.ObjectId, ref: 'users' }
  },
  { timestamps: true }
);

export const comments = model("comments", schema);
