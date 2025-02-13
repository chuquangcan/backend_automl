import axios from "axios";
import config from "../../../config/config.js";
import Dataset from "#api/models/dataset.model.js";
import Label from "#api/models/label.model.js";
import DatasetService from "../services/dataset.service.js";

const CreateClassificationDataset = async (req, res) => {
  const targetSize = 224;
  const { id } = req.params;
  try {
    const dataset = await Dataset.findOne({ project_id: id });
    const labels = await Label.find({ project_id: id });
    const tfrecordDatasetURL = `${config.storageBucketURL}/images/${id}/tfrecords-jpeg-${targetSize}x${targetSize}/`;
    const classes = labels.map((label) => label.name);

    await axios.post(`${config.mlServiceAddr}/clf/dataset`, {
      gcs_pattern: dataset.base_url,
      gcs_output: tfrecordDatasetURL,
      classes,
    });

    dataset.train_url = `${tfrecordDatasetURL}*.tfrec`;
    await dataset.save();
    return res.json({ message: "Dataset created successfully" });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const CreateLabelDataset = async (req, res) => {
  const { id } = req.params;
  const result = await DatasetService.createLabelDataset(id, req.body);
  if (result) {
    return res.json(result);
  } else return res.json({ message: "Label created faild" });
};

const DatasetController = {
  CreateClassificationDataset,
  CreateLabelDataset,
};

export default DatasetController;
