const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const archiver = require('archiver');

// Set up the input paths for your files
//const filesToZip = ['/path/to/file1', '/path/to/file2', '/path/to/file3'];

const zipFiles = (filesToZip, outputName) => {
// Set up the output path for your zip file
const outputPath = outputName;

// Create a new archive instance and pipe it to the output file
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', { zlib: { level: 9 } });
archive.pipe(output);

// Loop through each input file, add it to the archive, and delete the original file
filesToZip.forEach(file => {
  const fileName = path.basename(file);
  console.log(fileName,file)
  archive.file(file, { name: fileName });
  //fs.unlinkSync(file);
});

// Finalize the archive and close the output stream
archive.finalize();
output.on('close', () => {
  console.log(`Zip file created at ${outputPath}`);
  return outputPath
});
}
module.exports = zipFiles
