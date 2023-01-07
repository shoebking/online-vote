'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class voterData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      voterData.belongsTo(models.electionData, {
        foreignKey: "EID",
      });
      // Voters.hasMany(models.Voteresponses, {
      //   foreignKey: "VID",
      // });
    }
    
    passwordreset(password) {
      return this.update({ password });
    }

    static async createVoter({ voterId, password, EID }) {
      return await this.create({
        voterId,
        password,
        EID,
        isVoted: false,
        
      });
    }

    static async CountVoters(EID) {
      return await this.count({
        where: {
          EID,
        },
      });
    }

    static async GetVoters(EID) {
      return await this.findAll({
        where: {
          EID,
        },
        order: [["id", "ASC"]],
      });
    }

    static async GetVoter(id) {
      return await this.findOne({
        where: {
          id,
        },
      });
    }

    static async removevoter(id) {
      return await this.destroy({
        where: {
          id,
        },
      });
    }

    static async markasvoted(id) {
      return await this.update(
        {
          isVoted: true,
        },
        {
          where: {
            id: id,
          },
        }
      );
      
    }
    
  }
  voterData.init({
    voterId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isVoted:{
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: "voter",
    }
  }, {
    sequelize,
    modelName: 'voterData',
  });
  return voterData;
};