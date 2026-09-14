import multer from "multer";
import path from "path";
import fs from "fs";

const uploadRoot = path.join(
  process.cwd(),
  "backend",
  "uploads",
  "candidates"
);

const directories = {
  fee_statements: path.join(uploadRoot, "fee-statements"),
  result_slips: path.join(uploadRoot, "result-slips"),
  photos: path.join(uploadRoot, "photos"),
  videos: path.join(uploadRoot, "videos"),
};

for (const directory of Object.values(directories)) {
  fs.mkdirSync(directory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, file, callback) => {
    switch (file.fieldname) {
      case "fee_statement":
        callback(null, directories.fee_statements);
        break;

      case "result_slip":
        callback(null, directories.result_slips);
        break;

      case "photo":
        callback(null, directories.photos);
        break;

      case "video":
        callback(null, directories.videos);
        break;

      default:
        callback(
          new Error(`Unexpected file field: ${file.fieldname}`),
          ""
        );
    }
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1_000_000_000
    )}${extension}`;

    callback(null, uniqueName);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  callback: multer.FileFilterCallback
) {
  const allowedTypes: Record<string, string[]> = {
    fee_statement: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],

    result_slip: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ],

    photo: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],

    video: [
      "video/mp4",
      "video/webm",
    ],
  };

  const allowed = allowedTypes[file.fieldname];

  if (!allowed) {
    return callback(
      new Error(`Unexpected upload field: ${file.fieldname}`)
    );
  }

  if (!allowed.includes(file.mimetype)) {
    return callback(
      new Error(
        `Invalid file type for ${file.fieldname}`
      )
    );
  }

  callback(null, true);
}

export const candidateUpload = multer({
  storage,
  fileFilter,

  limits: {
    files: 4,
    fields: 20,
    fieldSize: 100 * 1024,
    fileSize: 50 * 1024 * 1024,
  },
});

export const voterImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) {
      callback(null, true);
      return;
    }
    callback(new Error("Only CSV voter files are accepted"));
  },
});
