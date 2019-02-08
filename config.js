'use strict';

const config = require('config');

function trelloConfig() {
    if (config.has('trello')) {
        return config.get('trello');
    } else {
        throw "No config for key 'trello'.";
    }
}

function googleSheetConfig() {
    if (config.has('googlesheet')) {
        return config.get('googlesheet');
    } else {
        throw "No config for key 'trello'.";
    }
}

module.exports = {
    getTrelloConfig: trelloConfig(),
    getGooglesheetConfig: googleSheetConfig(),
};
