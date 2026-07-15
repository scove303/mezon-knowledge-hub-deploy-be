import { z } from 'zod';

export const CreateFolderSchema = z.object({
  name: z
    .string()
    .min(1, 'Tên thư mục không được để trống')
    .max(100, 'Tên thư mục tối đa 100 ký tự'),
  type: z
    .enum(['roadmap', 'document', 'video', 'general'])
    .default('general'),
});
