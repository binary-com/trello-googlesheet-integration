'use strict';

const config = require('config');

function trelloConfig() {
    if (config.has('trello')) {
        return config.get('trello');
    }
}

function googleSheetConfig() {
    if (config.has('googlesheet')) {
        return config.get('googlesheet');
    }
}

module.exports = {
    getTrelloConfig: trelloConfig(),
    getGooglesheetConfig: googleSheetConfig(),
};
