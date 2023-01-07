'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class adminData extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      adminData.hasMany(models.electionData, {
        foreignKey: "AID",
      });
    }
    
    passwordreset(password) {
      return this.update({ password });
    }

    static addAdmin({ firstName, lastName, Email, password }) {
      return this.create({
        firstName,
        lastName,
        Email,
        password,
      });
    }
  }
  adminData.init({
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    Email:  {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: DataTypes.STRING,
    role: {
      type: DataTypes.STRING,
      defaultValue: "admin",
    }
  }, {
    sequelize,
    modelName: 'adminData',
  });
  return adminData;
};