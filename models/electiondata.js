'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class electionData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      electionData.belongsTo(models.adminData, {
        foreignKey: "AID",
      });
      electionData.hasMany(models.questionData, {
        foreignKey: "EID",
      });
      electionData.hasMany(models.voterData, {
        foreignKey: "EID",
      });
      // electionData.hasMany(models.Voteresponses, {
      //   foreignKey: "EID",
      // });
    }
      static createElection({ eName,url, AID }) {
        return this.create({
            eName,  
            url,      
            AID,          
        });
      }
      
     
      static GetElections(AID) {
        return this.findAll({
          where: {
            AID,
          },
          order: [["id", "ASC"]],
        });
      }
    
      static GetElection(id) {
        return this.findOne({
          where: {
            id,
          },
        });
      }
        
      static deleteElection(id) {
        return this.destroy({
          where: {
            id,
          },
        });
      }
  
      static GetUrl(url) {
        return this.findOne({
          where: {
            url,
          },
        });
      }
      static electionLaunch(id) {
        return this.update(
          {
            launch: true,
          },
          {
            returning: true,
            where: {
              id,
            },
          }
        );
      }
        
      static EndElection(id) {
        return this.update(
          {
            launch:false,
            stop: true 
          },
          {
            returning: true,
            where: {
              id: id,
            },
          }
        );
      }
}
   
  electionData.init({
    eName:{
      type:DataTypes.STRING,
      allowNull:false
    } ,
    url: {
      type: DataTypes.STRING,
      allowNull:false,
      unique:true
    },
    launch:{
      type:DataTypes.BOOLEAN,
      defaultValue:false
    } ,
    stop: {
      type:DataTypes.BOOLEAN,
      defaultValue:false
    },
  }, {
    sequelize,
    modelName: 'electionData',
  });
  return electionData;
};