module.exports = {
    activate(cfg) {
        appcd.register('/cli', ctx => {
            return 'CLI!';
        });

        appcd.register('/cli/schema', ctx => {
            return 'SCHEMA!';
        });
    }
};