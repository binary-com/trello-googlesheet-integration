const fs = require('fs-extra');
const prompt = require('prompt');
prompt.colors = false;

if (!process.env.CONFIG_FILE_PATH) throw 'Missing CONFIG_FILE_PATH. Please provide complete path to config file that will used to store trello and googlesheet configurations';

var schema = {
    properties: {
        'sprint.trello.board.id': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Enter trello board id used for sprint',
            message: 'Must be alphanumeric',
            required: true
        },
        'sprint.trello.board.listToExclude': {
            pattern: /^[A-Za-z0-9\s\()\.-]+(?:, ?[A-Za-z0-9\s\()\.-]+)*$/,
            description: 'List to exclude contains comma separated values for list to be excluded from fetching cards in corresponding list',
            message: 'Comma separated list of alphanumeric characters plus allower characters: (, ), space and -',
            default: 'Backlog'
        },
        'sprint.trello.label.name': {
            pattern: /^[a-zA-Z0-9\s]+$/,
            message: 'Must be alphanumeric characters separated by space.',
            description: 'Name for label used for cards in current sprint',
            default: 'Planned',
            required: true
        },
        'sprint.trello.label.id': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Id for label used for cards in current sprint',
            message: 'Must be alphanumeric.',
            required: true
        },
        'unplanned.trello.label.name': {
            pattern: /^[a-zA-Z0-9\s]+$/,
            message: 'Must be alphanumeric characters separated by space.',
            description: 'Name for label used for unplanned cards in current sprint',
            default: 'Unplanned',
            required: true
        },
        'unplanned.trello.label.id': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Id for label used for unplanned cards in current sprint',
            message: 'Must be alphanumeric.',
            required: true
        },
        'release.trello.board.id': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Enter trello board id used for release, that is, a separate board to handle completed sprint cards',
            message: 'Must be alphanumeric.',
        },
        'release.trello.board.listToExclude': {
            pattern: /^[A-Za-z0-9]+(?:, ?[A-Za-z0-9]+)*$/,
            description: 'List to exclude contains comma separated values for board list to be excluded from fetching cards in corresponding list',
            message: 'Comma separated list of alphanumeric characters'
        },
        'sheets.backlog.name': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Googlesheet sheet name used to maintain cards, and status, of current sprint.',
            message: 'Must be alphanumeric.',
            default: 'Sprint'
        },
        'sheets.backlog.range': {
            pattern: /^![A-Z]\d+(?:\:[A-Z]\d*){1}$/,
            message: 'Must be of GridRange format, for example, !A2:Z. Refer https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/other#gridrange',
            default: '!A2:H'
        },
        'sheets.unplanned.name': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Googlesheet sheet name used to maintain unplanned cards added in current sprint',
            message: 'Must be alphanumeric.',
            default: 'Unplanned'
        },
        'sheets.unplanned.range': {
            pattern: /^![A-Z]\d+(?:\:[A-Z]\d*){1}$/,
            message: 'Must be of GridRange format, for example, !A2:Z. Refer https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/other#gridrange',
            default: '!A3:H'
        },
    }
};

prompt.start();

prompt.get(schema, function(err, result) {
    const FILENAME = process.env.CONFIG_FILE_PATH;

    fs.outputFile(FILENAME, JSON.stringify(requestParamsToJSON(result), null, 2), 'utf8').then(() => {
        console.log('The config file was saved successfully.');
    }).catch(err => {
        console.log(err);
    });
});

/**
 * Populate and return JSON format from input enter on prompt line
 * @param {params} object that contains values provided
 */
function requestParamsToJSON(params) {
    let config = {
        "trello": {
            "board": {
                "sprint": {
                    "id": params['sprint.trello.board.id'],
                    "listToExclude": params['sprint.trello.board.listToExclude'],
                    "sprintLabel": {
                        "id": params['sprint.trello.label.id'],
                        "name": params['sprint.trello.label.name']
                    },
                    "unplannedLabel": {
                        "id": params['unplanned.trello.label.id'],
                        "name": params['unplanned.trello.label.name']
                    }
                },
                "release": {
                    "id": params['release.trello.board.id'],
                    "listToExclude": params['release.trello.board.listToExclude']
                }
            }
        },
        "googlesheet": {
            "sheets": {
                "backlog": {
                    "name": params['sheets.backlog.name'],
                    "range": params['sheets.backlog.range']
                },
                "unplanned": {
                    "name": params['sheets.unplanned.name'],
                    "range": params['sheets.unplanned.range']
                },
            }
        }
    };

    return config;
}