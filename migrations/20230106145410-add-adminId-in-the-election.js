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
    await queryInterface.addColumn("electionData", "AID", {
      type: Sequelize.DataTypes.INTEGER,
    });
    await queryInterface.addConstraint("electionData", {
      fields: ["AID"],
      type: "foreign key",
      references: {
        table: "adminData",
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
    await queryInterface.removeColumn("electionData", "AID");
  }
};
