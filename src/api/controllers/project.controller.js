import ProjectService from "../services/project.service.js";
import DatasetService from "../services/dataset.service.js";
import ImageService from "../services/image.service.js";
import LabelService from "../services/label.service.js";

import axios from "axios";
import config from "#src/config/config.js";

const List = async (req, res) => {
  const { _id } = req.user;
  try {
    const projects = await ProjectService.List(_id);
    return res.json(projects);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const Get = async (req, res) => {
  const { id } = req.params;
  try {
    const project = await ProjectService.Get(id);
    return res.json(project);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const Create = async (req, res) => {
  const { _id } = req.user;
  try {
    const project = await ProjectService.Create(_id, req.body);
    return res.json(project);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const Update = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    await ProjectService.Update(id, { name });
    return res.sendStatus(200);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const Delete = async (req, res) => {
  const { _id } = req.user;
  const { id } = req.params;
  try {
    await ProjectService.Delete(_id, id);
    return res.sendStatus(200);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const UploadFiles = async (req, res) => {
  const { _id } = req.user;
  const { id } = req.params;
  const { type } = req.body;
  try {
    const uploadedFiles = await ProjectService.UploadFiles(
      _id,
      id,
      req.files.files,
      type
    );
    return res.json(uploadedFiles);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error });
  }
};

const TrainModel = async (req, res) => {
  const { _id } = req.user;
  const { id: projectID } = req.params;

  try {
    const TrainingJob = await ProjectService.TrainModel(projectID);

    res.json(TrainingJob);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
};

const ListModel = async (req, res) => {
  const { _id } = req.user;
  const { project_id } = req.query;
  try {
    if (project_id) {
      const data = await ProjectService.ListModelByProject(project_id);
      res.json(data);
    } else {
      const data = await ProjectService.ListModelByUser(_id);
      res.json(data);
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
};

const CreateLSDataset = async (req, res) => {
  const { _id } = req.user;
  const { id: projectID } = req.params;
  dataset_config = req.body;
  try {
    const data = await ProjectService.CreateLSDataset(
      projectID,
      dataset_config
    );
    res.json(data);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
};

const GetLSDataset = async (req, res) => {
  const { _id } = req.user;
  const { id: projectID } = req.params;
  try {
    const data = await ProjectService.GetLSDataset(projectID);
    res.json(data);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
};

const GetDatasets = async (req, res) => {
  const { id } = req.params;
  const page = req.query.page || 1;
  try {
    const defaultPageSize = 24;
    const images = await ImageService.List(id, page, defaultPageSize);
    const labels = await LabelService.List(id);
    const labelResult = labels.map((v, i) => {
      return {
        id: v._id.toString(),
        value: v.name,
      };
    });
    const files = images.data.files.map((value, index) => {
      return value;
    });

    const results = {
      files: files,
      labels: labelResult,
      pagination: images.meta,
    };

    return res.json(results);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

const GetFullDatasets = async (req, res) => {
  const { id } = req.params;

  const page = req.query.page || 1;
  try {
    const defaultPageSize = -1;
    const images = await ImageService.List(id, page, defaultPageSize, true);
    const labels = await LabelService.List(id);
    const labelResult = labels.map((v, i) => {
      return {
        id: v._id.toString(),
        value: v.name,
      };
    });
    const files = images.data.files.map((value, index) => {
      return value;
    });
    const results = {
      files: files,
      labels: labelResult,
      pagination: images.meta,
    };
    return res.json(results);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

const ExplainInstance = async (req, res) => {
  // // const image = req.body.image
  // const {userEmail, projectName, runName } = JSON.parse(req.body.json);
  // console.log(userEmail, projectName, runName);
  // const options = {
  //     headers: {
  //         'Content-Type': 'multipart/form-data'
  //     }
  // }
  // try {
  //     const { data } = await axios.post(`${config.mlServiceAddr}/model_service/train/image_classification/explain`, {
  //         userEmail: userEmail,
  //         projectName: projectName,
  //         runName: runName,
  //         image: req.files.image
  //     }, options);
  //     const base64_image_str = data.explain_image;
  //     const explain_image_str = `data:image/jpeg;base64,${base64_image_str}`;
  //     return res.json({status: 'success', explain_image: explain_image_str})
  // } catch (err) {
  //     console.log(err);
  // }
};

const AutoLabeling = async (req, res) => {
  const { id } = req.params;
  console.log("project id", id, "auto labeling");
  try {
    const result = await ProjectService.AutoLabeling(id);
    if (result) return res.status(200).json(result);
    return res.status(204).json(result);
  } catch (error) {
    return "error";
  }
};

const ProjectController = {
  List,
  Get,
  Create,
  Update,
  Delete,
  UploadFiles,
  TrainModel,
  ListModel,
  CreateLSDataset,
  GetLSDataset,
  GetDatasets,
  ExplainInstance,
  AutoLabeling,
  GetFullDatasets,
};

export default ProjectController;
