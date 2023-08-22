import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { saveLocation } from './config.json';
import { appendFile, pathExists } from 'fs-extra';
import { CardData } from "./types";
import { unparse } from "papaparse";
import { SerialPort } from 'serialport';
import { ReadlineParser } from "@serialport/parser-readline";

// Locale-independent format
const timestampFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'medium' });

export let formattedData: Array<CardData> = [];
// @ts-ignore
export let cardReaders: Array<PortInfo> = [];
let timeSinceDup: number;

/**
 * Generates a file path for the csv file
 * @returns {Promise<string>} The file path
 * @async
 * @example
 * const filePath = await generateFilePath();
 * console.log(filePath);
 * // D:\Network\Drive\26-5-2021-12-0-Location-UUID.csv
 */
export const generateFilePath = async () => {
    const date: Date = new Date();
    const day: number = date.getDate();
    const month: number = date.getMonth() + 1;
    const year: number = date.getFullYear();
    const hours: number = date.getHours();
    const minutes: number = date.getMinutes();
    let location: string | null = window.sessionStorage.getItem("location");

    const fileName: string = `${day}-${month}-${year}-${hours}-${minutes}-${location}-${uuidv4()}.csv`;
    const filePath: string = path.join(saveLocation, fileName);
    return filePath;
}

/**
 * Appends the data to the csv file
 * @param {string} data The data to append to the file
 * @param {number} formattedDataLength The length of the formatted data array
 * @returns {Promise<boolean>} Whether the data was successfully appended to the file
 * @async
 * @example
 * const data = '"d477747c","4109496","04","26/05/22","","27/06/1987 12:00:00"';
 * const formattedDataLength = 1;
 * const success = await appendCSVFile(data, formattedDataLength);
 * console.log(success);
 * // true
 */
export const appendCSVFile = async (data: string, formattedDataLength: number) => {
    // write the csv header to the file if it doesn't exist
    if (!await pathExists(window.sessionStorage.getItem('filePath'))) {
        const csvHeader = '"serialNumber","universityNumber","issueNumber","startDate","error","timestamp"';
        appendFile(window.sessionStorage.getItem('filePath'), csvHeader + '\n').catch(err => {
            console.error(err);
            window.alert(`Something went wrong with writing to the file:\n${err}\n\nIf you have it open please close it and try again`);
            return window.location.reload();
        });
    }

    // write the data to the file
    appendFile(window.sessionStorage.getItem('filePath'), data).catch(err => {
        console.error(err);
        window.alert(`Something went wrong with writing to the file:\n${err}\n\nIf you have it open please close it and try again`);
        return window.location.reload();
    });
    return true;
}

/**
 * Handles the processed data from the card reader
 * @param {CardData} data The data to handle
 * @param {CardData[]} formattedData The formatted data array
 * @returns {void}
 * @example
 * const data = {
 *    serialNumber: 'd477747c',
 *   universityNumber: '4109496',
 *   issueNumber: '04',
 *  startDate: '26/05/22',
 * error: '',
 * timestamp: '27/06/1987 12:00:00'
 * };
 * const formattedData = [];
 * handleData(data, formattedData);
 * console.log(formattedData);
 * // [{
 * //    serialNumber: 'd477747c',
 * //    universityNumber: '4109496',
 * //    issueNumber: '04',
 * //    startDate: '26/05/22',
 * //    error: '',
 * //    timestamp: '27/06/1987 12:00:00'
 * // }]
 * console.log(asCSV);
 * // "d477747c","4109496","04","26/05/22","","27/06/1987 12:00:00"
 */
export const handleData = (data: CardData, formattedData: CardData[]) => {
    // return on error
    if (data.error !== '') return alert(`The last card scanned failed with the following reason:\n${data.error}\n\nPlease try again.`);
    data.timestamp = timestampFormat.format(Date.now());

    const previousData = formattedData.at(-1);
    // compare the serial number and university number to the last entry in the array, if they are the same data (prevents rapid duplicate entries)

    if (data.serialNumber === previousData?.serialNumber && data.universityNumber === previousData?.universityNumber) {
        if (timeSinceDup === undefined) timeSinceDup = Date.now();
        let cooldown: boolean = Date.now() - timeSinceDup > 360;
        if (!cooldown) {
            timeSinceDup = Date.now();
            return;
        }
        timeSinceDup = Date.now();
    }

    // convert the json to csv and write to the file
    const asCSV: string = unparse([data], { quotes: true, header: false });  // example of data: "d477747c","4109496","04","26/05/22","","27/06/1987 12:00:00"
    // push the data to the array for other functions to use
    formattedData.push(data);

    updateAttendanceView(data);
    return appendCSVFile(asCSV + '\n', formattedData.length);
};

const updateAttendanceView = (data: CardData) => {
    const timestampElement = document.createElement('p');
    timestampElement.innerHTML = data.timestamp;
    document.getElementById('attendance-view_timestamp')!.appendChild(timestampElement);
    const universityIdElement = document.createElement('p');
    universityIdElement.innerHTML = data.universityNumber;
    document.getElementById('attendance-view_universityId')!.appendChild(universityIdElement);
    const issueNumberElement = document.createElement('p');
    issueNumberElement.innerHTML = data.issueNumber;
    document.getElementById('attendance-view_issueNumber')!.appendChild(issueNumberElement);
    const serialNumberElement = document.createElement('p');
    serialNumberElement.innerHTML = data.serialNumber;
    document.getElementById('attendance-view_serialNumber')!.appendChild(serialNumberElement);
}

/**
 * Renders the attendance view
 * @param {CardData[]} formattedData The formatted data array
 * @returns {Promise<void>}
 * @async
 */
const renderAttendanceView = async (formattedData: CardData[]) => {
    document.querySelector('#main')!.innerHTML = `
        <div class="attendance-view">
            <h1>Attendance Monitoring for ${window.sessionStorage.getItem('location')}</h1>
            <h1>Data stored in ${window.sessionStorage.getItem('filePath')}</h1>
            <div class="attendance-view_column-parent">
            <div id="attendance-view_timestamp"><p class="attendance-view_column-header">Timestamp</p><p class="hidden">00000000000</p></div>
            <div id="attendance-view_universityId"><p class="attendance-view_column-header">University ID</p><p class="hidden">000000</p></div>
            <div id="attendance-view_issueNumber"><p class="attendance-view_column-header">Issue Number</p><p class="hidden">00</p></div>
            <div id="attendance-view_serialNumber"><p class="attendance-view_column-header">Serial Number</p><p class="hidden">0000000</p></div>
        </div>
    `;

    // if mock data is enabled, add a form to inject mock data
    if (window.sessionStorage.getItem('mock') === 'true') {
        const element = document.createElement('form');
        element.innerHTML = `
            <input type="text" id="timestampInput" placeholder="Timestamp...">
            <input type="text" id="universityIdInput" placeholder="University ID...">
            <input type="text" id="issueNumberInput" placeholder="Issue Number...">
            <input type="text" id="serialNumberInput" placeholder="Serial Number...">
            <input type="text" id="errorInput" placeholder="Error...">
            <input type="submit" value="Inject Mock Data">
        `;
        document.querySelector('.attendance-view')!.appendChild(element);

        element.addEventListener('submit', (event) => {
            event.preventDefault();
            const timestampElement = document.getElementById('timestampInput') as HTMLInputElement;
            const universityIdElement = document.getElementById('universityIdInput') as HTMLInputElement;
            const issueNumberElement = document.getElementById('issueNumberInput') as HTMLInputElement;
            const serialNumberElement = document.getElementById('serialNumberInput') as HTMLInputElement;
            const errorElement = document.getElementById('errorInput') as HTMLInputElement;

            const data: CardData = {
                serialNumber: serialNumberElement.value,
                universityNumber: universityIdElement.value,
                issueNumber: issueNumberElement.value,
                startDate: '',
                error: errorElement.value,
                timestamp: timestampElement.value,
            };

            handleData(data, formattedData);
        });
    }
};

/** 
 * Renders the location view
 * @param {CardData[]} formattedData The formatted data array
 * @returns {Promise<void>}
 * @async
 */
const renderLocationView = (formattedData: Array<CardData>) => {
    document.querySelector('#main')!.innerHTML = `
        <form id="locationForm">
            <input class="locationFormInput" type="text" id="locationInput" placeholder="Your Location...">
            <p id="inputError"></p>
            <input class="submitButton" type="submit" value="Continue">
        </form>
    `;
    document.getElementById('locationInput')!.focus();

    document.getElementById('locationForm')!.addEventListener('submit', async (event) => {
        event.preventDefault();
        const locationElement = document.getElementById('locationInput') as HTMLInputElement;
        if (locationElement.value === '') {
            locationElement.animate({
                translate: ['0px', '20px', '-20px', '0px'],
                easing: ['ease-in-out'],
            }, 500);
            document.getElementById('inputError')!.innerText = 'Location must be at least one character.';
            return;
        }
        window.sessionStorage.setItem('location', locationElement.value);

        window.sessionStorage.setItem('filePath', await generateFilePath());
        renderAttendanceView(formattedData);
    });
};

/** 
 * Starts the connection with the reader (via serialport)
 * @param {string} path The path to the reader
 * @returns {void}
 * @async
 */
export const startConnection = (path: string) => {
    // Create the serial port
    const port = new SerialPort({
        path: path,
        baudRate: 115200,
    })
    port.on('error', (err) => {
        console.error(err);
        alert(`Something went wrong with the reader:\n${err}\n\nPlease try again or select a different device`);
        return location.reload();
    });

    const parser = new ReadlineParser()
    port.pipe(parser);
    parser.on('data', (data: string) => {
        // example of data: {"serialNumber":"d477747c","universityNumber":"4109496","issueNumber":"1","startDate":"2021-03-15T12:00:00.000Z"}
        if (!data.includes('{') && !data.includes('}')) return false;
        let json = JSON.parse(data);
        return handleData(json, formattedData);
    });
    parser.on('error', (err) => {
        console.error(err);
        alert(`Something went wrong with the reader:\n${err}\n\nPlease try again or select a different device`);
        return location.reload();
    });
}

/** 
 * Sets up the connection with the reader 
 * Lets the user select the reader
 * Automatically selects if there's only one
 * Alerts the user if there's none
 * @returns {void}
 * @async
 */
export const setupConnection =  async () => {
    // Get a list of all the connected serial devices
    const serialPorts = await SerialPort.list();
    
    // Check which ones are card readers based on manufacturer
    serialPorts.forEach((port) => {
        if (port.manufacturer === 'wch.cn') {
            cardReaders.push(port);
        }
    })

    // If we found no card readers alert the user 
    if (cardReaders.length === 0) {
        window.alert('We couldn\'t find any card readers\nAre there any plugged in?');
    }

    // If there's only one reader, just start the connection
    if (cardReaders.length === 1) {
            startConnection(cardReaders[0].path)
            return renderLocationView(formattedData);
    }

    // If we did find card readers, add them to the drop-down 
    cardReaders.forEach((cardReader) => {
        const element = document.createElement('option');
        element.value = cardReader.path;
        element.innerText = cardReader.friendlyName;
        document.getElementById('usbSelector')!.appendChild(element);
    })

    // If there's more than one reader, prompt the user to select one
    document.getElementById('usbSelectorButton')!.addEventListener(('click'), () => {
        const element = document.getElementById('usbSelector') as HTMLInputElement;
        const path: string = element.value;
        if (path === '') {
            document.getElementById('inputError')!.innerText = 'Location must be at least one character.';
            return setupConnection();
        } else if (path === 'mock') {
            sessionStorage.setItem('mock', 'true');
        } else {
            startConnection(path);
        }
        return renderLocationView(formattedData);
    })
};