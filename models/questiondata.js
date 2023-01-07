'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class questionData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      questionData.belongsTo(models.electionData, {
        foreignKey: "EID",
      });
      questionData.hasMany(models.optionData, {
        foreignKey: "QID",
      });
      // EQuestion.hasMany(models.Voteresponses, {
      //   foreignKey: "QID",
      // });
    }

    static async CountQuestions(EID) {
      return await this.count({
        where: {
          EID,
        },
      });
    }

    static editQuestion({ question, description, id }) {
      return this.update(
        {
          question,
          description,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }

    static createquestion({question, description, EID }) {
      return this.create({
        question,
        description,
        EID,
      });
    }

    static async GetQuestion(id) {
      return await this.findOne({
        where: {
          id,
        },
      });
    }

    static removequestion(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }

    static async GetQuestions(EID) {
      return await this.findAll({
        where: {
          EID,
        },
        order: [["id", "ASC"]],
      });
    }
  }

  questionData.init({
    question: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'questionData',
  });
  return questionData;
};