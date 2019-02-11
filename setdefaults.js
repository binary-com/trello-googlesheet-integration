const fs = require('fs-extra');
const prompt = require('prompt');
prompt.colors = false;


var schema = {
    properties: {
        'sprint.trello.board.id': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Enter trello board id used for sprint',
            message: 'Must be alphanumberic',
            required: true
        },
        'sprint.trello.board.listToExclude': {
            pattern: /^[A-Za-z0-9]+(?:, ?[A-Za-z0-9]+)*$/,
            description: 'List to exclude contains comma separated values for list to be excluded from fetching cards in corresponding list',
            message: 'Comma separated list of alphanumeric characters',
            default: 'Backlog'
        },
        'sprint.trello.label.id': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Id for label used for cards in current sprint',
            message: 'Must be alphanumberic.',
            required: true
        },
        'sprint.trello.label.name': {
            pattern: /^[a-zA-Z0-9]+$/,
            message: 'Must be alphanumberic.',
            description: 'Name for label used for cards in current sprint',
            required: true,
            default: 'Planned'
        },
        'release.trello.board.id': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Enter trello board id used for release, that is, a separate board to handle completed sprint cards',
            message: 'Must be alphanumberic.',
        },
        'release.trello.board.listToExclude': {
            pattern: /^[A-Za-z0-9]+(?:, ?[A-Za-z0-9]+)*$/,
            description: 'List to exclude contains comma separated values for board list to be excluded from fetching cards in corresponding list',
            message: 'Comma separated list of alphanumeric characters'
        },
        'sheets.backlog.name': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Googlesheet sheet name used to maintain current sprint backlog',
            message: 'Must be alphanumberic.',
            default: 'SprintBacklog'
        },
        'sheets.backlog.range': {
            pattern: /^![A-Z]\d+(?:\:[A-Z]\d*){1}$/,
            default: '!A2:Z'
        },
        'sheets.unplanned.name': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Googlesheet sheet name used to maintain unplanned cards added in current sprint',
            message: 'Must be alphanumberic.',
            default: 'Unplanned'
        },
        'sheets.unplanned.range': {
            pattern: /^![A-Z]\d+(?:\:[A-Z]\d*){1}$/,
            default: '!A3:Z'
        },
        'sheets.sprint.name': {
            pattern: /^[a-zA-Z0-9]+$/,
            description: 'Googlesheet sheet name used to maintain status of planned cards of current sprint',
            message: 'Must be alphanumberic.',
            default: 'Sprint'
        },
        'sheets.sprint.range': {
            pattern: /^![A-Z]\d+(?:\:[A-Z]\d*){1}$/,
            default: '!A2:H'
        },
    }
};

prompt.start();

prompt.get(schema, function(err, result) {
    const FILENAME = process.env.CONFIG_FILE_PATH || 'config/default.json';

    fs.outputFile(FILENAME, JSON.stringify(requestParamsToJSON(result), null, 2), 'utf8').then(() => {
        console.log('The config file was saved!');
    }).catch(err => {
        console.log(err);
    });
});

function requestParamsToJSON(params) {
    let config = {
        "trello": {
            "board": {
                "sprint": {
                    "id": params['sprint.board.id'],
                    "listToExclude": params['sprint.trello.board.listToExclude'],
                    "sprintLabel": {
                        "id": params['sprint.trello.label.id'],
                        "name": params['sprint.trello.label.name']
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
                "sprint": {
                    "name": params['sheets.sprint.name'],
                    "range": params['sheets.sprint.range']
                }
            }
        }
    };

    return config;
}