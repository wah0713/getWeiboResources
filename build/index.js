const fs = require('fs')
const path = require('path')
const CleanCSS = require('clean-css');

let css = fs.readFileSync(path.resolve(__dirname, '../css/dev.css')).toString()
if (process.argv[2] === 'prod') {
    css = new CleanCSS().minify(css).styles + '\n'
}

const index = fs.readFileSync(path.resolve(__dirname, '../index.js')).toString()
const output = path.resolve(__dirname, '../dist/index.js')

const str = index.replace(/(?<=GM_addStyle\(`\s).*(?=`\))/gms, css)
fs.writeFile(output, str, {
    flag: 'w'
}, (error) => {
    if (error) throw error;
    console.log('done')
})