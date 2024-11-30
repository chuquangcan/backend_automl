import config from "#src/config/config.js";
import path from "path";
import mongoose from "mongoose";
import {
  UploadTypes,
  ALLOWED_FILE_EXTENSIONS,
  GCS_HOST,
  UPLOAD_BATCH_SIZE,
  FILE_NAME_LEN,
  ProjectTypes,
} from "../data/constants.js";
import LabelService from "./label.service.js";
import {
  getLabelAndFilePath,
  randomString,
  randomUID,
} from "../utils/string.util.js";
import Image from "../models/image.model.js";
import DatasetService from "./dataset.service.js";
import ProjectService from "./project.service.js";
import { count, error, log } from "console";
import fs from "fs";

import * as d3 from "d3";

const saveFileToLocal = async (validFiles, projectID, uploadType) => {
  var results = [];
  validFiles.forEach((file, index, readonly) => {
    var paths = file.name.split("/");
    var name = paths[paths.length - 1];
    var label = paths[paths.length - 2];

    var file_path = `public/media/upload/${projectID}/${name}`;

    file.url = `http://${config.hostIP}:${config.port}/${file_path.replace(
      "public/",
      ""
    )}`.replace("undefined", "localhost");
    file.key = file_path;
    file.label = label;
    results.push(file);
    fs.writeFile(file_path, file.data, (err) => {});
  });
  // log(results[0])

  return results;
};

const UploadLocalFiles = async (projectID, files, uploadType) => {
  try {
    const project = await ProjectService.Get(projectID);
    if (project.type == ProjectTypes.IMAGE_CLASSIFICATION)
      return await UploadLabeledImages_old(projectID, files, uploadType);
    if (project.type == ProjectTypes.TEXT_CLASSIFICATION) {
      return await UploadOneCSV(projectID, files);
    }
  } catch (error) {
    console.error(error);
    throw error;
  }

  // switch (uploadType) {
  //   case UploadTypes.FOLDER: // switch case not working
  //     return await UploadLabeledImages_old(projectID, files, uploadType)
  //   case UploadTypes.IMAGE_LABELED_FOLDER:
  //     return await UploadLabeledImages(projectID, files)
  //   case UploadTypes.CSV_SINGLE:
  //     throw new Error('Not implemented yet')
  // }
};

const UploadOneCSV = async (projectID, file) => {
  try {
    const results = d3.csvParse(file.data.toString());

    let text_col = "";
    let label_col = "";
    results.columns.forEach((column) => {
      column = column.toLowerCase();
      if (
        column.includes("text") ||
        column.includes("content") ||
        column.includes("sentence")
      )
        text_col = column;
      if (
        column.includes("label") ||
        column.includes("category") ||
        column.includes("class") ||
        column.includes("target")
      )
        label_col = column;
    });
    console.log("text_column: ", text_col);
    console.log("label_column: ", label_col);

    if (!text_col) throw new Error(`text or label column not found`);
    if (text_col == label_col)
      throw new Error(
        `text and label column must be different: found ${text_col}`
      );

    //* check and insert labels
    if (label_col) {
      console.log(`label column found`);

      let labels = [];
      results.forEach((row) => {
        if (!labels.includes(row[label_col])) labels.push(row[label_col]);
      });
      console.log("labels: ", labels);
      const insertingLabels = labels.map((label) => ({
        project_id: projectID,
        name: label,
      }));
      await LabelService.UpsertAll(projectID, insertingLabels);
    }
    const labelMap = await LabelService.GetLabelMap(projectID);

    //* create dataset
    const datasetInfo = {
      key: `label/${projectID}`,
      pattern: `public/label/${projectID}`,
      project_id: projectID,
    };
    const dataset = await DatasetService.Upsert(datasetInfo);

    //* insert texts, using old code for images
    let uploadedFilesInfo = [];
    let insertingFiles = [];

    results.forEach((row, index) => {
      const uid = randomUID();
      const labelingImageID = new mongoose.Types.ObjectId();

      const labelingImage = {
        name: `${file.name}-${index}`,
        project_id: projectID,
        uid,
        _id: labelingImageID,

        key: row[text_col],
        url: row[text_col],
        is_original: false,
        dataset_id: dataset._id,
      };

      let labelID = "";
      if (row[label_col]) {
        labelID = labelMap[row[label_col]];
        labelingImage.label_id = labelID;
      }
      insertingFiles.push(labelingImage);

      uploadedFilesInfo.push({
        _id: labelingImageID,
        label: row[label_col],
        label_id: labelID,
        uid,
        url: labelingImage.url,
      });
    });
    await Image.insertMany(insertingFiles);

    const defaultPageSize = 10;
    const totalPage = Math.ceil(uploadedFilesInfo.length / defaultPageSize);
    const fileInfo = uploadedFilesInfo.slice(0, defaultPageSize);
    // Convert label map to array of labels: { id, value }
    const labelsWithID = Object.entries(labelMap).map(([label, id]) => {
      return { id: id.toString(), value: label };
    });

    // Update project thumbnail
    const thumbnailURL = uploadedFilesInfo[0].url;
    await ProjectService.Update(projectID, {
      thumbnail_url: thumbnailURL,
      uploaded: true,
    });
    return {
      files: fileInfo,
      labels: labelsWithID,
      pagination: { page: 1, size: 24, total_page: totalPage },
    };
    throw new Error("Testing");
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const UploadLabeledImages_old = async (projectID, files, uploadType) => {
  console.log("UploadLabeledImages_old");
  try {
    const { labels, validFiles } = parseAndValidateFiles(files, uploadType);
    // console.log('valid file', validFiles[0]);

    const folderPath = `public/media/upload/${projectID}`;
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const uploadedFiles = await saveFileToLocal(
      validFiles,
      projectID,
      uploadType
    );
    // Upload folder
    const setLbData = new Set(uploadedFiles.map((v, i) => v.label));
    // const labelData = setLb.intersection(setLbData)
    const labelData = new Set([...labels].filter((i) => setLbData.has(i)));
    const lbs = [...labelData];

    if (lbs.length > 0) {
      const insertingLabels = lbs.map((label) => ({
        project_id: projectID,
        name: label,
      }));
      await LabelService.UpsertAll(projectID, insertingLabels);
    }
    const labelMap = await LabelService.GetLabelMap(projectID);
    const datasetInfo = {
      key: `label/${projectID}`,
      pattern: `public/label/${projectID}`,
      project_id: projectID,
    };
    const dataset = await DatasetService.Upsert(datasetInfo);

    const uploadedFilesInfo = await insertUploadedFiles(
      uploadedFiles,
      projectID,
      dataset._id,
      labelMap
    );

    const defaultPageSize = 12;
    const totalPage = Math.ceil(uploadedFilesInfo.length / defaultPageSize);
    const fileInfo = uploadedFilesInfo.slice(0, defaultPageSize);
    // Convert label map to array of labels: { id, value }
    const labelsWithID = Object.entries(labelMap).map(([label, id]) => {
      return { id: id.toString(), value: label };
    });

    // Update project thumbnail
    const thumbnailURL = uploadedFilesInfo[0].url;
    await ProjectService.Update(projectID, {
      thumbnail_url: thumbnailURL,
      uploaded: true,
    });
    return {
      files: fileInfo,
      labels: labelsWithID,
      pagination: { page: 1, size: 24, total_page: totalPage },
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const UploadLabeledImages = async (projectID, files) => {
  try {
    const { labels, validFiles } = parseAndValidateFiles(files, uploadType);
    // console.log('valid file', validFiles[0]);

    const folderPath = `public/media/upload/${projectID}`;
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const uploadedFiles = await saveFileToLocal(
      validFiles,
      projectID,
      uploadType
    );
    // Upload folder
    if (labels.length == 0) throw new Error("No label found");

    for (let i = 0; i < uploadedFiles.length; i++) {
      const label = labels[i];
      const labelPath = `public/media/upload/${projectID}/${label}`;
      if (!fs.existsSync(labelPath)) {
        fs.mkdirSync(labelPath, { recursive: true });
      }
    }

    const labelMap = await LabelService.GetLabelMap(projectID);
    const datasetInfo = {
      key: `label/${projectID}`,
      pattern: `public/label/${projectID}`,
      project_id: projectID,
    };
    const dataset = await DatasetService.Upsert(datasetInfo);

    const uploadedFilesInfo = await insertUploadedFiles(
      uploadedFiles,
      projectID,
      dataset._id,
      labelMap
    );

    const defaultPageSize = 24;
    const totalPage = Math.ceil(uploadedFilesInfo.length / defaultPageSize);
    const fileInfo = uploadedFilesInfo.slice(0, defaultPageSize);
    // Convert label map to array of labels: { id, value }
    const labelsWithID = Object.entries(labelMap).map(([label, id]) => {
      return { id: id.toString(), value: label };
    });

    // Update project thumbnail
    const thumbnailURL = uploadedFilesInfo[0].url;
    await ProjectService.Update(projectID, {
      thumbnail_url: thumbnailURL,
      uploaded: true,
    });
    return {
      files: fileInfo,
      labels: labelsWithID,
      pagination: { page: 1, size: 24, total_page: totalPage },
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const UploadFiles = async (projectID, files, uploadType) => {
  try {
    const { labels, validFiles } = parseAndValidateFiles(files, uploadType);
    const uploadedFiles = await uploadFilesToGCS(
      validFiles,
      projectID,
      uploadType
    );

    // Upload folder
    if (labels.length > 0) {
      const insertingLabels = labels.map((label) => ({
        project_id: projectID,
        name: label,
      }));
      await LabelService.UpsertAll(projectID, insertingLabels);
    }
    const labelMap = await LabelService.GetLabelMap(projectID);
    const datasetInfo = {
      key: `label/${projectID}`,
      pattern: `gs://${config.storageBucketName}/label/${projectID}`,
      project_id: projectID,
    };
    const dataset = await DatasetService.Upsert(datasetInfo);

    const uploadedFilesInfo = await insertUploadedFiles(
      uploadedFiles,
      projectID,
      dataset._id,
      labelMap
    );

    const defaultPageSize = 24;
    const totalPage = Math.ceil(uploadedFilesInfo.length / defaultPageSize);
    const fileInfo = uploadedFilesInfo.slice(0, defaultPageSize);
    // Convert label map to array of labels: { id, value }
    const labelsWithID = Object.entries(labelMap).map(([label, id]) => {
      return { id: id.toString(), value: label };
    });

    // Update project thumbnail
    const thumbnailURL = uploadedFilesInfo[0].url;
    await ProjectService.Update(projectID, {
      thumbnail_url: thumbnailURL,
      uploaded: true,
    });
    return {
      files: fileInfo,
      labels: labelsWithID,
      pagination: { page: 1, size: 24, total_page: totalPage },
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const DeleteFiles = async (keys) => {
  const successFiles = [];
  const errorFiles = [];
  try {
    const promises = await keys.map(async (key) => deleteLocalFile(key));
    const results = await Promise.allSettled(promises);
    // TODO: handle error
    results.forEach((result, idx) => {
      if (result.status !== "fulfilled") {
        console.error(result.reason);
        errorFiles.push(keys[idx]);
      } else {
        successFiles.push(keys[idx]);
      }
    });
    console.log(
      `${successFiles.length} file(s) deleted successfully, ${errorFiles.length} error(s).`
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const insertUploadedFiles = async (
  uploadedFiles,
  projectID,
  datasetID,
  labelMap
) => {
  // const imageURLPrefix = `${GCS_HOST}/${config.storageBucketName}`
  const imageURLPrefix = `media/upload/${projectID}`;
  const insertingFiles = [];
  const uploadedFilesInfo = [];
  try {
    uploadedFiles.forEach((file) => {
      const uid = randomUID();
      const labelingImageID = new mongoose.Types.ObjectId();
      const baseInfo = {
        name: file.name,
        project_id: projectID,
        uid,
        label_by: "ukn",
      };
      // insertingFiles.push({
      //   ...baseInfo,
      //   key: `${file.key}`,
      //   url: `${imageURLPrefix}/${file.key}`,
      //   is_original: true,
      // })

      const labelingImage = {
        ...baseInfo,
        _id: labelingImageID,
        key: `${file.key}`,
        url: file.url,
        is_original: false,
        dataset_id: datasetID,
      };

      let labelID = "";
      if (file?.label && file.label.length > 0) {
        labelID = labelMap[file.label];
        labelingImage.label_id = labelID;
        labelingImage.label_by = "human";
      }
      insertingFiles.push(labelingImage);
      uploadedFilesInfo.push({
        _id: labelingImageID,
        label: file.label,
        label_id: labelID,
        uid,
        url: labelingImage.url,
      });
    });
    await Image.insertMany(insertingFiles);
  } catch (error) {
    console.error(error);
    throw error;
  }
  return uploadedFilesInfo;
};

const parseAndValidateFiles = (files, uploadType) => {
  const validFiles = [];
  const labels = [];
  for (let i = 0; i < files.length; i++) {
    if (uploadType == UploadTypes.FOLDER) {
      // Decode base64
      const originalFileName = Buffer.from(files[i].name, "base64").toString(
        "ascii"
      );
      const { label, path } = getLabelAndFilePath(originalFileName);
      if (labels.indexOf(label) < 0) {
        labels.push(label);
      }
      files[i].name = path;
    }
    const fileName = files[i].name;
    if (fileName.startsWith(".")) {
      continue;
    }
    if (isAllowedExtension(fileName)) {
      files[i].name = generateUniqueFileName(files[i].name);
      validFiles.push(files[i]);
    } else {
      console.error("File extension not supported: ", fileName);
      throw new Error("File extension not supported");
    }
  }
  return { labels, validFiles };
};

const isAllowedExtension = (fileName) => {
  const idx = fileName.lastIndexOf(".");
  if (idx <= 0) {
    return false;
  }
  const ext = fileName.substring(idx + 1, fileName.length);
  return ALLOWED_FILE_EXTENSIONS.includes(ext);
};

// TODO: using socket for realtime rendering
const uploadFilesToGCS = async (files, projectID, uploadType) => {
  const timeNowUnix = new Date().getTime();
  const uploadedFiles = [];
  for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
    const promises = files
      .slice(i, i + UPLOAD_BATCH_SIZE)
      .map((file) => uploadFile(file, projectID, uploadType));
    const results = await Promise.allSettled(promises);
    results.forEach((result) => {
      if (result.status !== "fulfilled") {
        console.error(result.reason);
      }
      uploadedFiles.push(result.value);
    });
    console.log(
      `#${i / UPLOAD_BATCH_SIZE + 1} - [${i} to ${
        i + UPLOAD_BATCH_SIZE
      }]: Upload done`
    );
  }
  const doneTime = new Date().getTime();
  const timeDiff = (doneTime - timeNowUnix) / 1000;
  console.log(
    `Successfully uploaded ${files.length} file(s), total time: ${timeDiff} seconds`
  );
  return uploadedFiles;
};

const uploadFile = async (file, projectID, uploadType) => {
  const fileName = file.name;
  // TODO: add time unix to file name, make public at file level
  const keyWithoutPrefix = `${projectID}/${fileName}`;
  const objKey = `images/${keyWithoutPrefix}`;
  const datasetKey = `label/${keyWithoutPrefix}`;
  try {
    await config.storageBucket.file(objKey).save(file.data);
    const paths = fileName.split("/");
    const name = paths[paths.length - 1];
    let label = "";
    if (uploadType == UploadTypes.FOLDER) {
      // TODO: ensure paths.length > 2
      label = paths[paths.length - 2];
    }
    await copyFile(objKey, datasetKey);
    return { key: keyWithoutPrefix, name, label };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const copyFile = async (srcFileName, destFileName) => {
  const copyDestination = config.storageBucket.file(destFileName);
  try {
    await config.storageBucket.file(srcFileName).copy(copyDestination);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const MoveFile = async (srcFileName, destFileName) => {
  try {
    await config.storageBucket.file(srcFileName).move(destFileName);
    console.log(
      `gs://${config.storageBucketName}/${srcFileName} moved to gs://${config.storageBucketName}/${destFileName}`
    );
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const deleteFile = async (fileObjKey) => {
  try {
    await config.storageBucket.file(fileObjKey).delete();
    console.log(`gs://${config.storageBucketName}/${fileObjKey} deleted`);
  } catch (error) {
    console.error(error);
    throw error;
  }
};
const deleteLocalFile = async (fileObjKey) => {
  try {
    fs.rm(fileObjKey, { recursive: true, force: true }, (error) => {
      if (error) console.error(error);
    });
    console.log(`${fileObjKey} deleted`);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const generateUniqueFileName = (originalFileName) => {
  let paths = originalFileName.split("/");
  const extension = path.extname(paths[paths.length - 1]);
  paths = paths.slice(0, -1);
  paths.push(randomString(FILE_NAME_LEN));
  const fileName = paths.join("/");
  return `${fileName}${extension}`;
};

// const generateUniqueFileName = (originalFileName) => {
//   const { dir, name, ext } = path.parse(originalFileName)
//   const uniqueFileName = randomString(20)
//   return `${dir}/${uniqueFileName}${ext}`
// }

const StorageService = { UploadFiles, DeleteFiles, MoveFile, UploadLocalFiles };
export default StorageService;
