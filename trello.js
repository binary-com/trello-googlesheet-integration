'use strict';

const Trello = require('trello');
const config = require('./config.js');

let trelloConfig = config.getTrelloConfig;
let trello = new Trello(process.env.TRELLO_API_KEY, process.env.TRELLO_API_TOKEN);

let allCards = [];
let plannedCards = [];
let unplannedCards = [];

/**
 * Fetch all the cards for board specified in config file
 * @param{board} board name for which cards need to be fetched [optional]
 */
async function getCards(board = trelloConfig.board.sprint) {
    let lists = await getTrelloListOnBoard();
    let promiseArray = [];

    lists.forEach((list) => {
        promiseArray.push(getCardsOnList(list));
    });

    await Promise.all(promiseArray).then(() => {
        // no processing
    }, (reason) => {
        console.log(reason);
    });

    // get planned and unplanned card only when its sprint board
    if (board.sprintLabel) {
        allCards.forEach(function(card) {
            let plannedLabel = card.labels.filter(label => {
                if (board.sprintLabel && label.name === board.sprintLabel.name) {
                    return label;
                }
            });
            if (plannedLabel.length > 0) {
                plannedCards.push(filterCardDetails(card));
            } else {
                unplannedCards.push(filterCardDetails(card));
            }
        });
    }

    // return all cards as well planned and unplanned
    // cards for easy access later
    return {
        all: allCards,
        planned: plannedCards,
        unplanned: unplannedCards
    };
}

/**
 * Fetch all the list on board
 * It ignores list specified in config file listToExclude
 * @param{board} board name for which lists need to be fetched [optional]
 */
function getTrelloListOnBoard(board = trelloConfig.board.sprint) {
    return trello.getListsOnBoard(board.id).then((lists) => {
        return lists.filter(list => list.name && !(board.listToExclude.split(',').indexOf(list.name) > -1));
    }, (reason) => {
        console.log(reason);
    });
}

/**
 * Get cards on a particular list
 * @param {list} list on trello
 */
function getCardsOnList(list) {
    return trello.getCardsOnList(list.id).then((cards) => {
        return allCards.push(...cards);
    }, (reason) => {
        console.log(reason);
        return [];
    });
}

/*
 * Add sprint label at start of sprint to cards in trello board
 */
async function addSprintLabel() {
    let cards = await getCards();
    cards.all.forEach((card) => {
        trello.addLabelToCard(card.id, trelloConfig.board.sprint.sprintLabel.id).then((response) => {
            console.log("Label successfully added.");
        }, (reason) => {
            console.log(reason);
        });
    });
}

/*
 * Get card details for particular trello card
 * if card is not found in sprint board it then check
 * for card in release board
 * @param {id} id of the trello card
 */
async function getCardDetails(id) {
    const TRELLO_CARD_NOT_FOUND_ERRORS = ["Could not find the card", "invalid id"];
    return trello.getCard(trelloConfig.board.sprint.id, id).then((card) => {
        if (TRELLO_CARD_NOT_FOUND_ERRORS.includes(card)) {
            return trello.getCard(trelloConfig.board.release.id, id).then((card) => {
                if (TRELLO_CARD_NOT_FOUND_ERRORS.includes(card)) {
                    return;
                } else {
                    return filterCardDetails(card);
                }
            }, (reason) => {
                return;
            });
        } else {
            return filterCardDetails(card);
        }
    }, (reason) => {
        return;
    });
}


/**
 * Filter details of card to what fields are required
 * @param {card} card on trello
 */
function filterCardDetails(card) {
    return {
        name: card.name,
        identifier: card.id,
        url: card.shortUrl,
        estimate: getEstimateFromCardName(card.name),
        consumed: getConsumedFromCardName(card.name)
    };
}

/**
 * Get estimate pointsfrom card name/title,
 * for e.g. consider (16) sample task [20] as card name
 * then this sub will return 16, we use scrum plugin
 * to add estimated and consumed points
 * @{cardName} name or title of the card
 */
function getEstimateFromCardName(cardName) {
    let regExp = /^\([-+]?[0-9]*\.?[0-9]+\)/;

    let estimate;
    if (regExp.test(cardName)) {
        estimate = parseFloat(regExp.exec(cardName)[0].match(/[-+]?[0-9]*\.?[0-9]+/)[0]);
    }

    return estimate;
}

/**
 * Get consumed points from card name/title,
 * for e.g. consider (16) sample task [20] as card name
 * then this sub will return 20, we use scrum plugin
 * to add estimated and consumed points
 * @{cardName} name or title of the card
 */
function getConsumedFromCardName(cardName) {
    let regExp = /\[[-+]?[0-9]*\.?[0-9]+\]$/;

    let consumed;
    if (regExp.test(cardName)) {
        consumed = parseFloat(regExp.exec(cardName)[0].match(/[-+]?[0-9]*\.?[0-9]+/)[0]);
    }

    return consumed;
}

module.exports = {
    getCards: getCards,
    getCardDetails: getCardDetails,
    addSprintLabel: addSprintLabel
};