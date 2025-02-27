module.exports = {
    up: async (queryInterface, Sequelize) => {
        return queryInterface.addColumn("Articles", "isManualSubmission", {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    },

    down: async (queryInterface, Sequelize) => {
        return queryInterface.removeColumn("Articles", "isManualSubmission");
    }
};
