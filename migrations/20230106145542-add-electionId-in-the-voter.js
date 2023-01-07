'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn("voterData", "EID", {
      type: Sequelize.DataTypes.INTEGER,
    });
    await queryInterface.addConstraint("voterData", {
      fields: ["EID"],
      type: "foreign key",
      references: {
        table: "electionData",
        field: "id",
      },
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeColumn("voterData", "EID");
  }
};
