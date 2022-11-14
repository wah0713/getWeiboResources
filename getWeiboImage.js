// ==UserScript==
// @name         微博一键取图（9宫格）
// @namespace    https://github.com/wah0713/getWeiboImage
// @version      2.02
// @description  一个兴趣使然的脚本，本来只是取图。
// @supportURL   https://github.com/wah0713/getWeiboImage/issues
// @author       wah0713
// @compatible   chrome
// @license      MIT
// @icon         https://weibo.com/favicon.ico
// @require      https://cdn.bootcss.com/jquery/1.12.4/jquery.min.js
// @require      https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @match        *://weibo.com/*
// @noframes     true
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(async function () {
    let vueRecycleScrollerDom = $('.Main_full_1dfQX')
    vueRecycleScrollerDom.on('click', '.head-info_info_2AspQ', async function () {
        const imgUrlList = []
        const $imgDomList = $(this).parents('.Feed_body_3R0rO').find('.picture.content_row_-r5Tk .woo-picture-slot')
        const writerName = $(this).prev().find('.head_name_24eEB').text()
        const time = $(this).find('.head-info_time_6sFQg').attr('title')
        $imgDomList.each((index, item) => {
            let fileDom = null
            if ($(item).find('img,video').length) {
                fileDom = $(item).find('img,video')[0]
            } else {
                fileDom = $(item).prevAll('img,video')[0]
            }
            let url = fileDom.src
            if (fileDom.nodeName === 'IMG') {
                url = fileDom.src.replace(/(?<=(cn)\/).+(?=(\/))/, 'large')
            }
            imgUrlList.push({
                url,
                id: index + 1
            })
        })
        console.log(`imgUrlList`, imgUrlList)
        const promiseList = imgUrlList.map(item => getFileBlob(item))
        const imageRes = await Promise.all(promiseList)

        // 打包
        var zip = new JSZip();
        imageRes.forEach(function (obj) {
            const suffixName = new URL(obj.finalUrl).pathname.match(/\.\w+$/)[0]
            const name = `${obj._id}${suffixName}`
            console.log(`name`, name)
            zip.file(name, obj._blob);
        });

        // 生成zip文件并下载
        zip.generateAsync({
            type: 'blob'
        }).then((content) => {
            GM_download({
                url: URL.createObjectURL(content),
                name: `${writerName}${time}.zip`,
            })
        })
    })

    function getFileBlob(data) {
        return new Promise((resolve, rejcet) => {
            GM_xmlhttpRequest({
                url: data.url,
                method: 'get',
                responseType: 'blob',
                headers: {
                    referer: 'https://weibo.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
                },
                onload: (res) => {
                    console.log(`onload`)
                    resolve({
                        ...res,
                        _blob: res.response,
                        _id: data.id
                    })
                },
                onerror: (res) => {
                    console.log(`onerror`, res)
                    resolve(null)
                }
            })
        })
    }

    GM_addStyle(``)

    // // debugJS
    // unsafeWindow.$ = $
    // setTimeout(() => {}, 5 * 1000);
})()