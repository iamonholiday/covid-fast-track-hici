const fetch = require("node-fetch");
const Bluebird = require("bluebird");
const request = require("request");
const _ = require("lodash");
var mysql = require("mysql");
fetch.Promise = Bluebird;

// googleapis
const { google } = require("googleapis");
const docs = require("@googleapis/docs");

const express = require("express");
const app = express();
const port = 3000;

const auth = new docs.auth.GoogleAuth({
  keyFile: "./client_secret.json",
  scopes: "https://www.googleapis.com/auth/spreadsheets"
});

// spreadsheet id
const spreadsheetId = "1UBq5fRqUVGJjZh5dgBusM3w5B2ygVYfHPKTgPev4k8k";

const token = process.env.TOKEN;
const sheetBaseUri = process.env.SHEET_BASE_URI;

async function sleep(millis) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

app.get("/", (req, res) => {
  res.send(process.env.TOKEN);
});

app.get("/load-patient-list", async (req, res) => {
  const token = process.env.TOKEN;

  const jsonData = await fetch(
    "https://api-hibkkcare.bangkok.go.th/beds?hospital=60f92f35c06493bc482dfd6c&_sort=no:ASC&patient_null=false&_start=200",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9,th;q=0.8",
        authorization: `Bearer ${token}`,
        "sec-ch-ua":
          '"Chromium";v="92", " Not A;Brand";v="99", "Microsoft Edge";v="92"',
        "sec-ch-ua-mobile": "?0",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site"
      },
      referrer: "https://hibkkcare.bangkok.go.th/",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: null,
      method: "GET",
      mode: "cors"
    }
  ).then((res) => res.json()); // expecting a json response

  res.send(jsonData);
});

app.get("/test-update-by-id", async (req, res) => {
  // const resultData = await getAllIndexAsMap() || new Map();
  const [ddPatient, badData] = await getPatientListFromHiCi();

  const testKeys = [];
  const nArr = [];

  for (const ie of [...ddPatient]) {
    {
      const iKey = ie[0];
      const iValue = ie[1];

      testKeys.push(iKey);
      const arr = Object.entries(iValue).map((ie) => ie[1]);

      nArr.push(arr);
    }
  }

  if (nArr.length > 0) {
    // const latestData = await getAllIndexAsMap() || new Map();
    // const startAppendIndex = [...latestData.values()].length;

    const arrChunk = _.chunk(nArr, 500);
    let incIndex = 2;
    for (const iArr of arrChunk) {
      await appendPatientData(incIndex, iArr);
      await sleep(1500);
      incIndex = incIndex + iArr.length;
    }
  }

  res.send(
    `<strong>PENDING CASE</strong> -> ${nArr.length}<br />
        <strong>BAD DATA</strong>
        <ul>
            ${badData.map((ie) => "<li>" + ie + "</li>").join("")}
        </ul>
        `
  );
});

async function getPatientListFromSheetAsDict() {
  const authClientObject = await auth.getClient();
  const googleSheetsInstance = google.sheets({
    version: "v4",
    auth: authClientObject
  });

  const request = {
    // The ID of the spreadsheet to retrieve data from.
    spreadsheetId: spreadsheetId, // TODO: Update placeholder value.

    // The A1 notation of the values to retrieve.
    range: "A:S", // TODO: Update placeholder value.

    // How values should be represented in the output.
    // The default render option is ValueRenderOption.FORMATTED_VALUE.
    // valueRenderOption: '',  // TODO: Update placeholder value.

    // How dates, times, and durations should be represented in the output.
    // This is ignored if value_render_option is
    // FORMATTED_VALUE.
    // The default dateTime render option is [DateTimeRenderOption.SERIAL_NUMBER].
    // dateTimeRenderOption: '',  // TODO: Update placeholder value.

    auth: authClientObject
  };

  try {
    const response = (
      await googleSheetsInstance.spreadsheets.values.get(request)
    ).data;
    // TODO: Change code below to process the `response` object:
    // console.info(JSON.stringify(response, null, 2));
    // return response.values;
    //
    const keys = response.values[0];
    const resultData = new Map();
    response.values.filter((ie, ieIdx) => {
      const passTest = ieIdx > 0;
      if (passTest) {
        const dd = _.zipObject(keys, ie);
        resultData.set(dd.patient_id, dd);
      }
      return passTest;
    });

    console.info(JSON.stringify(resultData, null, 2));

    return resultData;
    //
    //
    //
  } catch (err) {
    console.error(err);
  }

  return null;
}

async function getPatientListFromHiCi() {
  const tf = new Map();
  const now = Date.now();
  const token = process.env.TOKEN;
  const badData = [];

  const steps = new Array(20).fill(0).map((ie, ieIdx) => ieIdx * 500);
  const allObject = [];
  for (const iReq of steps) {
    const jsonData = await fetch(
      `https://api-hibkkcare.bangkok.go.th/orders?hospital=60f92f35c06493bc482dfd6c&_sort=_id:DESC&type=ONE_TIMES&status=PENDING&_start=${iReq}&_limit=500`,
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "en-US,en;q=0.9,th;q=0.8",
          authorization:
            "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwZjlmYTcyNzg4Mjc4NWI1YzZiNDg2YyIsImlhdCI6MTYyNzY0MDgzMSwiZXhwIjoxNjMwMjMyODMxfQ.iiw7dC063MsuJ2IYPBhzX6WOvRo7P2NZmin-CYpxaV0",
          "sec-ch-ua":
            '"Chromium";v="92", " Not A;Brand";v="99", "Microsoft Edge";v="92"',
          "sec-ch-ua-mobile": "?0",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site"
        },
        referrer: "https://hibkkcare.bangkok.go.th/",
        referrerPolicy: "strict-origin-when-cross-origin",
        body: null,
        method: "GET",
        mode: "cors"
      }
    ).then((res) => res.json()); // expecting a json response

    jsonData
      .filter((ie) => {
        allObject.push(ie);
        return ie.status === "PENDING" && ie.medicines.length > 0;
      })
      .forEach((ie) => {
        // ie?.patient?.,

        const cbMedicine = (obj) => {
          if (!ie.medicines) {
            return "";
          }

          const arrMed = ie.medicines.map((ie) => {
            const iDrugName = ie.name.split(" (")[0] || "";

            return iDrugName;
          });

          return arrMed.join(", ");
        };

        const cbHn = (testObj) => {
          if (!testObj) {
            return "";
          } else {
            return testObj;
          }
        };

        const cbRoundToSession = (dt) => {
          const cmpHour = Number(dt.match(/(?:T)\d{2}/g)[0].replace("T", ""));

          if (cmpHour < 8) {
            return `08:00`;
          } else if (cmpHour < 13) {
            return `13:00`;
          } else {
            return `17:00`;
          }
        };

        try {
          if (ie.patient) {
            const dd = {
              patient_id: ie["_id"],
              updated_datetime: now,
              session_datetime: cbRoundToSession(ie.updatedAt),
              patient_status: (ie.patient || { status: "" }).status,
              patient_code: `HN${cbHn((ie.patient || { hn: "" }).hn)}`,

              patient_name: `${ie.patient.name} ${ie.patient.surname}`,
              patient_tel: ie.patient.phone,
              patient_address: (ie.patient.address || { subdistrict: "" })
                .subdistrict,
              patient_link: `https://hibkkcare.bangkok.go.th/member/patient/${ie.patient.id}`,
              patient_drugs: cbMedicine(ie)
            };
            tf.set(dd.patient_id, dd);
          } else {
            console.log(`warn no data on patient_id => ${ie._id}`);
            badData.push(ie._id);
          }
        } catch (err) {
          console.log(`unexpected data on patient_id => ${ie._id}`, err);
          badData.push(ie._id);
        }
      });
  }

  console.log(`======= loaded ${allObject.length} =======`);
  return [tf, badData];
}

async function getSheetAsAllData() {
  const baseUri = `https://hibkkcare.bangkok.go.th/member/patient`;
  const sheetUri = `${sheetBaseUri}/exec?path=/interface-data&limit=1000`;

  const requestOptions = {
    method: "GET",
    redirect: "follow"
  };

  const resultAsJSON = await fetch(
    `${sheetUri}`,
    requestOptions
  ).then((response) => response.json());

  return resultAsJSON;
}

async function getAllIndexAsMap() {
  const authClientObject = await auth.getClient();
  const googleSheetsInstance = google.sheets({
    version: "v4",
    auth: authClientObject
  });

  const request = {
    // The ID of the spreadsheet to retrieve data from.
    spreadsheetId: spreadsheetId, // TODO: Update placeholder value.

    // The A1 notation of the values to retrieve.
    range: "B:B", // TODO: Update placeholder value.
    auth: authClientObject
  };

  try {
    const response = (
      await googleSheetsInstance.spreadsheets.values.get(request)
    ).data;

    const tf = new Map();
    response.values.map((ie, ieIdx) => {
      tf.set(ie[0], ieIdx + 1);
    });

    return tf;
  } catch (err) {
    console.error(err);
  }

  return null;
}

async function updatePatientDataByIndex(aIndex, values) {
  const authClientObject = await auth.getClient();
  const googleSheetsInstance = google.sheets({
    version: "v4",
    auth: authClientObject
  });

  const request = {
    // The ID of the spreadsheet to retrieve data from.
    spreadsheetId: spreadsheetId, // TODO: Update placeholder value.
    range: `B${aIndex}:K${aIndex}`, // 'A6:C6',  // TODO: Update placeholder value.
    auth: authClientObject,
    valueInputOption: "RAW",
    requestBody: {
      range: `B${aIndex}:K${aIndex}`,
      values: [values]
    }
  };

  try {
    const response = (
      await googleSheetsInstance.spreadsheets.values.update(request)
    ).data;

    return response;
  } catch (err) {
    console.error(err);
  }

  return null;
}

async function updatePatientDataAll(values) {
  const authClientObject = await auth.getClient();
  const googleSheetsInstance = google.sheets({
    version: "v4",
    auth: authClientObject
  });

  const request = {
    // The ID of the spreadsheet to retrieve data from.
    spreadsheetId: spreadsheetId, // TODO: Update placeholder value.
    range: `B:K`, // 'A6:C6',  // TODO: Update placeholder value.
    auth: authClientObject,
    valueInputOption: "RAW",
    requestBody: {
      range: `B:K`,
      values: values
    }
  };

  try {
    const response = (
      await googleSheetsInstance.spreadsheets.values.update(request)
    ).data;

    return response;
  } catch (err) {
    console.error(err);
  }

  return null;
}

async function appendPatientData(startIndex, values) {
  startIndex = startIndex < 2 ? 2 : startIndex;
  const endIndex = startIndex + values.length;

  const authClientObject = await auth.getClient();
  const googleSheetsInstance = google.sheets({
    version: "v4",
    auth: authClientObject
  });

  const request = {
    // The ID of the spreadsheet to retrieve data from.
    spreadsheetId: spreadsheetId, // TODO: Update placeholder value.
    range: `B${startIndex}:K${endIndex}`, // 'A6:C6',  // TODO: Update placeholder value.
    auth: authClientObject,
    valueInputOption: "RAW",
    requestBody: {
      range: `B${startIndex}:K${endIndex}`,
      values: values
    }
  };

  try {
    const response = (
      await googleSheetsInstance.spreadsheets.values.append(request)
    ).data;

    return response;
  } catch (err) {
    console.error(err);
  }

  return null;
}

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
