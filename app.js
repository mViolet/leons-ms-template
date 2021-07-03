const express = require("express");
const app = express();
const multer = require("multer");
const upload = multer({
  storage: multer.diskStorage({}),
  fileFilter: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
      cb(new Error("File type is not supported"), false);
      return;
    }
    cb(null, true);
  },
});

//MS Specific
const axios = require("axios").default;
const async = require("async");
const fs = require("fs");
const https = require("https");
const path = require("path");
const createReadStream = require("fs").createReadStream;
const sleep = require("util").promisify(setTimeout);
const ComputerVisionClient =
  require("@azure/cognitiveservices-computervision").ComputerVisionClient;
const ApiKeyCredentials = require("@azure/ms-rest-js").ApiKeyCredentials;

require("dotenv").config({ path: "./config/.env" });

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const key = process.env.MS_COMPUTER_VISION_SUBSCRIPTION_KEY;
const endpoint = process.env.MS_COMPUTER_VISION_ENDPOINT;
const faceEndpoint = process.env.MS_FACE_ENDPOINT;
const subscriptionKey = process.env.MS_FACE_SUB_KEY;

const computerVisionClient = new ComputerVisionClient(
  new ApiKeyCredentials({ inHeader: { "Ocp-Apim-Subscription-Key": key } }),
  endpoint
);

//Server Setup
app.set("view engine", "ejs");
app.use(express.static("public"));

//Routes
app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.post("/", upload.single("file-to-upload"), async (req, res) => {
  try {
    // Upload image to cloudinary
    const result = await cloudinary.uploader.upload(req.file.path);
    const uploadedImg = result.secure_url;
    async.series([
      async function () {

        // Analyze URL image
        console.log('Analyzing URL image to describe...', uploadedImg.split('/').pop());
        const caption = (await computerVisionClient.describeImage(uploadedImg)).captions[0];
        console.log(`This may be ${caption.text} (${caption.confidence.toFixed(2)} confidence)`);

        /*
        DETECT TAGS
        */
        console.log('------------'); console.log('DETECT TAGS');
        console.log();
  
        const tagsURL = uploadedImg
  
        // Analyze URL image
        console.log('Analyzing tags in image...', tagsURL.split('/').pop());
        const tags = (await computerVisionClient.analyzeImage(tagsURL, { visualFeatures: ['Tags'] })).tags;
        console.log(`Tags: ${formatTags(tags)}`);

        // Format tags for display
        function formatTags(tags) {
          return tags.map(tag => (`${tag.name} (${tag.confidence.toFixed(2)})`)).join(', ');
        }

        /*
        DETECT COLOR SCHEME
        Detects the color scheme of an image, including foreground, background, dominant, and accent colors.  
        */
        console.log('------------'); console.log('DETECT COLORS');
        console.log();
  
        const colorURLImage = uploadedImg
        const colorMap = { Black: "#000000", Blue: "#0000ff", Brown: "a52a2a", Gray: "808080", Green: "#00ff00", Orange: "#ffa500", Pink: "#ffc0cb", Purple: "#800080", Red: "#ff0000", Teal: "#008080", White: "#ffffff", Yellow: "#FFFF00"}
        
        // Analyze URL image
        console.log('Analyzing image for color scheme...', colorURLImage.split('/').pop());
        console.log();
        const color = (await computerVisionClient.analyzeImage(colorURLImage, { visualFeatures: ['Color'] })).color;
        printColorScheme(color);

        // Print a detected color scheme
        function printColorScheme(colors) {
          console.log(`Image is in ${colors.isBwImg ? 'black and white' : 'color'}`);
          console.log(`Dominant colors: ${colors.dominantColors.join(', ')}`);
          console.log(`Dominant foreground color: ${colors.dominantColorForeground}`);
          console.log(`Dominant background color: ${colors.dominantColorBackground}`);
          console.log(`Suggested accent color: #${colors.accentColor}`);
        }

        //input: two colors as hex strings (without #)
        //return: array of strings - [rgb value, hex value]
        function blendHexColors(c0, c1) { //color 0(accent?), color 1
          const a = c0.match(/.{1,2}/g)
          const b = c1.match(/.{1,2}/g)
          let newColor = []

          a.forEach((el, i) => {
            let rgbA = parseInt(el, 16)
            let rgbB = parseInt(b[i], 16)
            newColor.push(Math.round((rgbA + rgbB) / 2))
          })
          newColor.forEach(el => (el <= 255) ? el : 255) //max is 255

          function toHex(value) {
            return value.toString(16).padStart(2, '0')
          }

          return [`rgb(${newColor[0]}, ${newColor[1]}, ${newColor[2]})`,
          `#${toHex(newColor[0])}${toHex(newColor[1])}${toHex(newColor[2])}`]
        }
        res.render("result.ejs", { caption: caption.text, img: uploadedImg, clrs: [[color.accentColor], color.dominantColors.join(', '), color.dominantColorBackground, color.dominantColorForeground] });
      },
      function () {
        return new Promise((resolve) => {
          resolve();
        })
      }
    ], (err) => {
      throw (err);
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(process.env.PORT || 8000);
