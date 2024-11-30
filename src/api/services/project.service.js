import axios from "axios";
import config from "#src/config/config.js";
import Project from "#api/models/project.model.js";
import User from "#api/models/user.model.js";
import Image from "#api/models/image.model.js";
import Experiment from "#api/models/experiment.model.js";
import {
  ProjectCodePrefixes,
  PROJECT_CODE_LEN,
  ProjectTypes,
  UploadTypes,
} from "../data/constants.js";
import { randomString } from "#api/utils/string.util.js";
import StorageService from "./storage.service.js";
import LabelService from "./label.service.js";
import DatasetService from "./dataset.service.js";
import ImageService from "./image.service.js";
import ExperimentService from "./experiment.service.js";
import MLModel from "../models/mlmodel.model.js";

const List = async (userID) => {
  try {
    const projects = await Project.find({ author: userID }).sort("-createdAt");
    return projects;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const Get = async (projectID) => {
  try {
    const project = await Project.findOne({ _id: projectID });
    if (!project) {
      throw new Error("Project does not exist");
    }
    return project;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const Create = async (
  userID,
  { name, description, expectation_accuracy, type }
) => {
  if (!ProjectTypes.hasOwnProperty(type)) {
    return res.status(400).json({ error: "Project type invalid" });
  }

  try {
    const existingProject = await Project.findOne({
      name: name,
      author: userID,
    });
    console.log(existingProject);
    if (existingProject != undefined) {
      throw new Error("Project already exist");
    }

    const projectCode = generateProjectCode(type);

    // const ls_create_project = await axios.post(`${config.mlServiceAddr}/label_service/projects/create`, {
    //   "name": name,
    //   "type": type,
    //   "label_config": {
    //     "label_type": "any",
    //     "label_choices": []
    //   }
    // })
    const project = new Project({
      name,
      description,
      expectation_accuracy,
      type,
      code: projectCode,
      //ls_project_id: ls_create_project.data.id,
      author: userID,
    });

    await project.save();

    return project;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const Update = async (projectID, updateInfo) => {
  try {
    const project = await Project.findOne({ _id: projectID });
    if (project == undefined) {
      throw new Error("Project does not exist");
    }

    if (updateInfo.name) {
      const existingProject = await Project.findOne({ _id: projectID, name });
      if (existingProject != undefined) {
        throw new Error("Project name is already taken");
      }
    }
    await project.updateOne(updateInfo);
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const Delete = async (userID, projectID) => {
  //TODO: Delete label studio project
  try {
    const project = await Project.findOne({ _id: projectID, author: userID });
    if (project == undefined) {
      throw new Error("Project does not exist");
    }

    if (project.type === ProjectTypes.IMAGE_CLASSIFICATION) {
      const images = await Image.find({ project_id: projectID });
      if (images && images.length > 0) {
        const imageKeys = images.map((image) => image.key);
        // TODO: Use transaction
        await StorageService.DeleteFiles(imageKeys);
      }
    }
    await ImageService.DeleteByProject(projectID);
    await LabelService.DeleteAllByProject(projectID);
    await DatasetService.DeleteAllByProject(projectID);
    await ExperimentService.DeleteByProject(projectID);
    await Project.deleteOne({ _id: projectID });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const CreateLSDataset = async (projectID, dataset_config) => {
  try {
    const project = await Project.findOne({ _id: projectID });
    if (project == undefined) throw new Error("Project not found");
    if (project.ls_project_id)
      throw new Error("Label Studio project already created");

    const { data } = await axios.post(
      `${config.mlServiceAddr}/label_service/projects/create`,
      {
        name: project.name,
        type: project.type,
        label_config: {
          label_type: "multiclass", //TODO: add support for other label types
          // default label choices for 4 animal image classification
          label_choices: dataset_config.label_choices || [
            "dog",
            "cat",
            "horse",
            "deer",
          ],
        },
      }
    );
    project.ls_project_id = data.id;
    await project.save();
    return { ls_project_id: data.id };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const GetLSDataset = async (projectID) => {
  try {
    const project = await Project.findOne({ _id: projectID });
    if (project == undefined) throw new Error("Project not found");
    if (!project.ls_project_id)
      throw new Error("Label Studio project not created");
    return { message: "Not implemented" };
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const UploadFiles = async (userID, projectID, files, uploadType) => {
  try {
    const project = await Project.findOne({ _id: projectID }).populate(
      "author"
    );
    if (project == undefined) {
      throw new Error("Project not found");
    }
    // Shallow compare because project.author._id is ObjectId, _id is string
    if (project.author._id != userID) {
      throw new Error("Forbidden");
    }

    if (!files) {
      throw new Error("Files can not be empty");
    }

    const uploadedFiles = await StorageService.UploadLocalFiles(
      project._id,
      files,
      uploadType
    );

    return uploadedFiles;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const TrainModel = async (projectID) => {
  try {
    // const dataset = await DatasetService.ListByProject(projectID)
    // const labelMap = await LabelService.GetLabelMap(projectID)
    // const classes = Object.keys(labelMap)
    // const experiment = await ExperimentService.LatestByProject(projectID)
    // const experimentName = experiment.name

    const project = await Project.findOne({ _id: projectID });
    const user = await User.findOne({ _id: project.author });

    const userEmail = user.email.split("@")[0];
    const presets = "high_quality";
    const payload = {
      userEmail: userEmail,
      projectId: projectID,
      runName: "ISE",
      training_time: 60,
      presets: presets,
      //add dataset config
    };
    let service_route = "";
    switch (project.type) {
      case ProjectTypes.IMAGE_CLASSIFICATION:
        service_route = `${config.mlServiceAddr}/model_service/train/v2/image_classification`;
        break;
      case ProjectTypes.TEXT_CLASSIFICATION:
        service_route = `${config.mlServiceAddr}/model_service/train/v2/text_prediction`;
        break;
      default:
        throw new Error(
          "Project type currently not supported: " + project.type
        );
    }

    const respone = await axios.post(service_route, payload);
    if (respone.status !== 200) {
      throw new Error("Call ml-service training failed");
    }
    const data = respone.data;
    // console.log(data)
    const task_id = data.task_id;
    ExperimentService.Create({
      experiment_name: task_id,
      project_id: projectID,
    });
    return data;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const ListModelByUser = async (userID) => {
  try {
    const models = await MLModel.find({ author_id: userID }).sort("-createdAt");
    return models;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const ListModelByProject = async (projectID) => {
  try {
    const models = await MLModel.find({ project_id: projectID }).sort(
      "-createdAt"
    );
    return models;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const generateProjectCode = (projectType) => {
  const prefix = ProjectCodePrefixes[projectType];
  const code = randomString(PROJECT_CODE_LEN);
  return `${prefix}-${code}`;
};

const AutoLabeling = async (project_id) => {
  const project = await Project.findOne({ _id: project_id });
  const images = await ImageService.List(project_id, -1, -1, true);
  const body = {
    project: project,
    data: images,
  };
  const labelData = await axios.post(config.dataServiceIp + "/datasets", body);
  // console.log('lbdata??', labelData);

  if (labelData.data === "error") {
    return;
  }
  await ImageService.UpdateLabelPrediction(labelData.data);
  return labelData.data;
};

const ProjectService = {
  List,
  Get,
  Create,
  Update,
  Delete,
  CreateLSDataset,
  GetLSDataset,
  UploadFiles,
  TrainModel,
  ListModelByUser,
  ListModelByProject,
  AutoLabeling,
};

export default ProjectService;
