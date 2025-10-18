import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {
  S3Client,
  //   ListBucketsCommand,
  //   ListObjectsV2Command,
  //   GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import prisma from "@view-port/db";



const S3 = new S3Client({
  region: "auto",
  endpoint: `https://4f7f562f61d26a8078f069ab48697497.r2.cloudflarestorage.com/view-port`,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID || "",
    secretAccessKey: process.env.SECRET_ACCESS_KEY || "",
  },
});

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN || "",
    allowMethods: ["GET", "POST"],
  }),
);


app.get("/", (c) => {
  return c.text("OK");
});


app.post("/presigned", async (c) => {
  try {
    const { fileName, fileType, group_id, user_id } = await c.req.json();

    if (!fileName || !fileType || !group_id || !user_id) {
      return c.json({ error: "Missing required fields: fileName, fileType, group_id, or user_id" }, 400);
    }

    if (!fileType.startsWith('image/')) {
      return c.json({ error: "Only image files are allowed" }, 400);
    }

    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${group_id}}.${fileExtension}`;
    const bucketName = process.env.R2_BUCKET_NAME || "view-port";

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueFileName,
      ContentType: fileType,
    });

    // Generate presigned URL for GET operation (to return to client for future reference)
    // const getCommand = new GetObjectCommand({
    //   Bucket: bucketName,
    //   Key: uniqueFileName
    // });

  const uploadUrl = await getSignedUrl(S3, putCommand, { expiresIn: 60 }); 


    // await prisma.viewportObject.create({
    //   data: {
    //     group_id,
    //     user_id,
    //     objects: [],
    //     image_url: uniqueFileName
    //   }
    // })

    return c.json({
      success: true,
      uploadUrl,
      fileName: uniqueFileName,
      message: "Upload URL generated successfully"
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
})


import { serve } from "@hono/node-server";

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
