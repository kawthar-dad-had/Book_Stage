var fs = require('fs');
var EPub = require('epub');
var {convert} = require('html-to-text');
var path = require('path');
var htmlParser = require('node-html-parser');

  /**
   * EpubToText#extract()
   *
   * Opens the EPUB in sourceFile, extracts all chapters
   * and calls a callback function with the chapter content.
   * Callback parameters are (err, chapterText, sequenceNumber).
   *
   * An optional callback function can also be called initially,
   * at the beginning of the extraction.
   * Callback parameters are (err, numberOfChapters)
   **/

  function extract(sourceFile, callback, initialCallback){
    var epub = new EPub(sourceFile);

    // callback fired for each chapter (or they are written to disk)
    epub.on('end', function() {
      epub.flow.forEach(function(chapter, sequence) {
        epub.getChapter(chapter.id, function(err, html) {
          var txt = '';
          if (html) {
            txt = convert(html , {ignoreHref: true});
          };
          var meta = {};
          meta.id = chapter.id;
          meta.excerpt = txt.trim().slice(0, 250);
          meta.size = txt.length
          meta.sequence_number = sequence
          if (chapter.title) {
            meta.title = chapter.title
          } else {
            meta.title = getTitleFromHtml(html);
          }
          callback(err, txt, sequence, meta);
        });
      });
    });

    // callback as soon as file is ready to give info on how many chapters will be processed
    epub.on('end', function() {
      if (initialCallback) {
        initialCallback(null, epub.flow.length);
      };
    });

    epub.parse();
  }


  /**
   * EpubToText#extractTo()
   *
   * Opens the EPUB in sourceFile and saves all chapters
   * in destFolder. Chapters will be name according to the
   * original file name, prefixed by a 5-digit sequence number
   * Call a callback function when done.
   * Callback parameters are (err)
   **/
  
   function  extractTo  (sourceFile, destFolder , mdata, callback)   {
    var totalCount;
    var processedCount = 0;
    var destFile = ''
    console.log(mdata.titleCatalogue)

    if (mdata.authorLastNameCatalog == '' || mdata.authorFirsNameCatalog == '') {
      if (mdata.titleCatalogue != '') {
        destFile = destFolder + '/' + mdata.creatorEpub +' '+mdata.titleCatalogue+ '.txt'
      }else {
        destFile = destFolder + '/' + mdata.creatorEpub +' '+mdata.titleEpub+ '.txt'
      }
      
    }else {
      if (mdata.titleCatalogue != '') {
        destFile = destFolder + '/' + mdata.authorLastNameCatalog +' '+ mdata.authorFirsNameCatalog +' '+mdata.titleCatalogue+ '.txt'
      }else {
        destFile = destFolder + '/' + mdata.authorLastNameCatalog +' '+ mdata.authorFirsNameCatalog +' '+mdata.titleEpub+ '.txt'
      }
      
    }
    //var destFile = destFolder + '/' + path.basename(sourceFile) + '.txt'
    var txt1 = ''
    extract(sourceFile, (err, txt, sequence) => {
        txt1 = txt1 + txt
      fs.writeFileSync(destFile, txt1);
      processedCount += 1;
      if (processedCount >= totalCount) {
        callback("done");
      }
    }, (err, numberOfChapters) => {
      totalCount = numberOfChapters
    });
    
    fs.writeFileSync(destFile, txt1);
    return destFile
  }

  /**
   * EpubToText#getTitleFromHtml()
   *
   * Best efforts to find a title in the HTML tags (title, H1, etc.)
   **/
    function getTitleFromHtml(html) {
    const root = htmlParser.parse(html);
    var title = root.querySelector('h1');
    if (title == null) {
      title = root.querySelector('title');
      if (title == null) {
        return '';
      };
    };
    return title.structuredText.replace("\n", " ");
  }
module.exports = {
    extractTo
}