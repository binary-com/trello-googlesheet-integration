'use strict';

const fs = require('fs');
const util = require('util');
const {
    google
} = require('googleapis');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage')
const config = require('./config.js');
const trello = require('./trello.js');

const SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets',
];

const optionDefinitions = [{
    name: 'operation',
    alias: 'o',
    type: String,
    description: "Operation you want to perform on your google spreadsheet. Current operations are: {blue.bold get} - {cyan.italic get list of entries in google spreatsheet (take additional option --sheet)}, {blue.bold addSprintLabel} - {cyan.italic add sprint label, default: Planned, to cards in trello board (perform this at starting of sprint)}, {blue.bold createBacklog} - {cyan.italic fetch cards in current sprint from trello board and write them to google spreadsheet (perform this at starting of each sprint)}, {blue.bold addToUnplanned} - {cyan.italic update unplanned google spreadsheet for cards added in between sprint}, {blue.bold updateSheet} - {cyan.italic Read current entries present in sheet then fetch corresponding card details from trello and update values} and {blue.bold clear} - {cyan.italic clear list of cards in google spreadsheet (take additional option --sheet)}"
}, {
    name: 'sheet',
    alias: 's',
    type: String,
    defaultValue: "backlog",
    description: "Name of sheet in google spreadsheet on which you want to perform operation. Allowed - {blue.bold backlog, unplanned}, {cyan default: backlog}."
}, {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: "Display this usage guide.",
}, ];

const sections = [{
        header: 'Trello google sheet integration for sprint',
        content: 'Integrate trello and google sheet for handling sprint for your team.'
    },
    {
        header: 'Synopsis',
        content: '$ node index.js <options>'
    },
    {
        header: 'Options',
        optionList: optionDefinitions,
        tableOptions: {
            columns: [{
                    name: 'option',
                    noWrap: true,
                    width: 30
                },
                {
                    name: 'description',
                    width: 50,
                }
            ]
        }
    }
]

const options = commandLineArgs(optionDefinitions, {
    stopAtFirstUnknown: true
});
const usage = commandLineUsage(sections)
const help = options.help;

if (help) {
    console.log(usage);
    return;
}

// validates
if (!process.env.NODE_CONFIG_DIR) throw 'Missing NODE_CONFIG_DIR. Please pass the config directory path where config file is present. To set config file please make use "setdefaults.js".';

if (!process.env.GOOGLE_PRIVATE_KEY_FILE_PATH) throw 'Missing GOOGLE_PRIVATE_KEY_FILE_PATH. Please get JWT private key file from your account. Refer https://developers.google.com/identity/protocols/OAuth2ServiceAccount#jwt-auth.';

if (!process.env.GOOGLE_SPREADSHEET_ID) throw 'Missing GOOGLE_SPREADSHEET_ID, Please provide spreadsheet id to track sprint.';

if (!process.env.TRELLO_API_KEY) throw 'Missing TRELLO_API_KEY. Please provide your trello user API key.';

if (!process.env.TRELLO_API_TOKEN) throw 'Missing TRELLO_API_TOKEN. Please provide your trello user API token.';


const operation = options.operation;
const sheetName = options.sheet ? options.sheet : "backlog";
const googlesheetConfig = config.getGooglesheetConfig;

if (options.sheet && !/^(?:backlog|unplanned)$/.test(options.sheet)) {
    console.log("Invalid sheet name provided. Only backlog and unplanned are allowed");
    return;
}

if (!operation) {
    console.log("No operation provided! Usage <script> --<operation_name>");
    console.log("Operations allowed: get|clear|createBacklog|addToUnplanned|updateSheet|addSprintLabel");
} else if (/^(?:get|clear|createBacklog|addToUnplanned|addSprintLabel|updateSheet)$/.test(operation)) {
    switch (operation) {
        case "get":
            authorize().then(get);
            break;
        case "clear":
            authorize().then(clear);
            break;
        case "createBacklog":
            authorize().then(writeSprintBacklog);
            break;
        case "addToUnplanned":
            authorize().then(addToUnplanned);
            break;
        case "addSprintLabel":
            trello.addSprintLabel()
            break;
        case "updateSheet":
            authorize().then(updateSheet);
            break;
    }
}

/**
 * Read google sheet jwt credentials from file
 */
async function readCredentialsFile() {
    const readFile = util.promisify(fs.readFile);
    return await readFile(process.env.GOOGLE_PRIVATE_KEY_FILE_PATH, 'utf8');
}

/**
 * Get google auth JWT client with specified scopes
 * @param {privatekey} contains content of jwt credentials file
 */
async function getAuthenticatedClient(privatekey) {
    return await new google.auth.JWT(
        privatekey.client_email,
        null,
        privatekey.private_key,
        SCOPES);
}

/**
 * Return an authenticated client to be used for current operation
 */
async function authorize() {
    const data = await readCredentialsFile()

    return await getAuthenticatedClient(JSON.parse(data));
}

/**
 * Get and print to console the rows fetched for
 * google sheet
 * @param {auth} The google authentication client based on JWT
 */
function get(auth) {
    const sheets = google.sheets({
        version: 'v4',
    });

    sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: googlesheetConfig["sheets"][sheetName]["name"] + googlesheetConfig["sheets"][sheetName]["range"],
    }, (err, response) => {
        if (err) {
            console.error(err);
            return;
        }

        console.log("Status", response.status);
        console.log(JSON.stringify(response.data, null, 2));
    });
}

/**
 * Fetch trello cards marked with sprint label and
 * write to sprint backlog google sheet
 * @param {auth} The google authentication client based on JWT
 */
async function writeSprintBacklog(auth) {
    const sheets = google.sheets({
        version: 'v4',
        auth
    });

    let cards = await getTrelloCards("planned");

    if (!cards || cards.length === 0) {
        console.log("No cards. Nothing updated!");
        return;
    }

    sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: googlesheetConfig["sheets"]["backlog"]["name"] + googlesheetConfig["sheets"]["backlog"]["range"],
    }, (err, response) => {
        if (err) {
            console.error(err);
            return;
        }

        if (response.status == 200 && response.data.values && response.data.values.length > 0) {
            console.error("Sprint backlog already contains data. If it's for new sprint please clear data first using clear operation.");
        } else {
            sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: googlesheetConfig["sheets"]["backlog"]["name"] + '!A2',
                valueInputOption: 'USER_ENTERED',
                resource: {
                    majorDimension: "ROWS",
                    values: cards,
                },
            }, (err, response) => {
                if (err) {
                    console.error(err);
                    return;
                }

                console.log("Status", response.status);
                console.log(JSON.stringify(response.data, null, 2));
            });
        }
    });
}

/**
 * Clear out the google sheet based on sheet name passed
 * @param {auth} The google authentication client based on JWT
 */
function clear(auth) {
    const sheets = google.sheets({
        version: 'v4',
        auth
    });

    sheets.spreadsheets.values.clear({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: googlesheetConfig["sheets"][sheetName]["name"] + googlesheetConfig["sheets"][sheetName]["range"],
    }, (err, response) => {
        if (err) {
            console.error(err);
            return;
        }

        console.log("Status", response.status);
        console.log(JSON.stringify(response.data, null, 2));
    });
}

/**
 * Fetch trello cards not marked with sprint label and
 * write to unplanned google sheet cards that are not
 * already added to the sheet
 * @param {auth} The google authentication client based on JWT
 */
async function addToUnplanned(auth) {
    const sheets = google.sheets({
        version: 'v4',
        auth
    });

    const unplannedCards = await getTrelloCards("unplanned");

    if (!unplannedCards || unplannedCards.length === 0) {
        console.log("No cards. Nothing updated!");
        return;
    }

    sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: googlesheetConfig["sheets"]["unplanned"]["name"] + googlesheetConfig["sheets"]["unplanned"]["range"],
    }, (err, response) => {
        if (err) {
            console.error(err);
            return;
        }

        const existingEntries = response.data.values;

        let cardIdentifiers = {};
        if (existingEntries && existingEntries.length > 0) {
            existingEntries.forEach((entry) => {
                cardIdentifiers[entry[1]] = entry[1]
            });
        }

        let cards = unplannedCards.filter((card) => {
            return !cardIdentifiers[card[1]]
        });

        sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: googlesheetConfig["sheets"]["unplanned"]["name"] + '!A3',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            responseDateTimeRenderOption: 'FORMATTED_STRING',
            resource: {
                majorDimension: "ROWS",
                values: cards,
            },
        }, (err, response) => {
            if (err) {
                console.error(err);
                return;
            }

            console.log("Status", response.status);
            console.log(JSON.stringify(response.data, null, 2));
        });

    });
}

/**
 * Read current entries present in sheet then fetch
 * corresponding card details from trello and update values
 * fetched from trello.
 * @param {auth} The google authentication client based on JWT
 */
let detailsToUpdate = [];
async function updateSheet(auth) {
    const sheets = google.sheets({
        version: 'v4',
        auth
    });

    let promiseArray = [];
    sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: googlesheetConfig["sheets"][sheetName]["name"] + googlesheetConfig["sheets"][sheetName]["range"],
    }, (err, response) => {
        if (err) {
            console.error(err);
            return;
        }

        const existingEntries = response.data.values;

        if (existingEntries && existingEntries.length > 0) {
            let count = 2;
            let rangeNumberMatch = googlesheetConfig["sheets"][sheetName]["range"].match(/\d+/);
            if (rangeNumberMatch && rangeNumberMatch.length > 0) {
                count = rangeNumberMatch[0];
            }

            existingEntries.forEach((entry) => {
                promiseArray.push(getDetailsInSheetFormat(entry, count));
                count++;
            });

            Promise.all(promiseArray).then(() => {
                sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                    resource: {
                        valueInputOption: 'USER_ENTERED',
                        responseDateTimeRenderOption: 'FORMATTED_STRING',
                        data: detailsToUpdate
                    },
                }, (err, response) => {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    console.log("Status", response.status);
                    console.log(JSON.stringify(response.data, null, 2));
                });
            }, (reason) => {
                console.log(reason);
            });
        } else {
            console.log("No data present in sheet to be updated.");
        }
    });
}

/**
 * Get all trello cards of board, for particular
 * label
 * @param {label} label for which filtering needs to be done
 */
async function getTrelloCards(label) {
    let cards = await trello.getCards();
    let values = [];

    cards[label].forEach((card) => {
        values.push(filterDetailsOfCard(card));
    });

    return values;
};

/**
 * Filter details of trello card that are required to be populated
 * in sheet and return in particular order
 * @param {card} card for which filtering needs to be done
 */
function filterDetailsOfCard(card) {
    return [card.name, card.identifier, card.url, card.estimate, card.consumed]
}

/**
 * Get details of card in particular format required for batch update
 * operation of google sheet api
 * @param {entry} row in googlesheet
 * @param {currentRangeIndex} current range for entry in google sheet
 */
async function getDetailsInSheetFormat(entry, currentRangeIndex) {
    let details = await trello.getCardDetails(entry[1]);

    let processedDetails = entry;
    if (details) {
        processedDetails = filterDetailsOfCard(details);
    }
    processedDetails = processedDetails.map((value) => [value])

    detailsToUpdate.push({
        range: googlesheetConfig["sheets"][sheetName]["name"] + '!A' + currentRangeIndex + ':E' + currentRangeIndex,
        majorDimension: "COLUMNS",
        values: processedDetails
    });

    return;
}
