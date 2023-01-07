'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class optionData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      optionData.belongsTo(models.questionData, {
        foreignKey: "QID",
      });
      // Choices.hasMany(models.Voteresponses, {
      //   foreignKey: "voterchoice",
      // });
    }
    static Getoptions(QID) {
      return this.findAll({
        where: {
          QID,
        },
        order: [["id", "ASC"]],
      });
    }

    static Getoption(id) {
      return this.findOne({
        where: {
          id,
        },
      });
    }

    static addoption({ choice, QID }) {
      return this.create({
        choice,
        QID,
      });
    }

    static editoption({ choice, id }) {
      return this.update(
        {
          choice,
        },
        {
          where: {
            id,
          },
        }
      );
    }

    static removeoption(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }
  }
  optionData.init({
    choice: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'optionData',
  });
  return optionData;
};