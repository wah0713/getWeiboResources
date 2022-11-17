// ==UserScript==
// @name         微博一键取图（9宫格）
// @namespace    https://github.com/wah0713/getWeiboImage
// @version      1.02
// @description  一个兴趣使然的脚本，微博（weibo|wb）一键取图脚本。
// @supportURL   https://github.com/wah0713/getWeiboImage/issues
// @author       wah0713
// @compatible   chrome
// @license      MIT
// @icon         https://weibo.com/favicon.ico
// @require      https://cdn.bootcss.com/jquery/1.12.4/jquery.min.js
// @require      https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @match        *://weibo.com/*
// @connect      sinaimg.cn
// @connect      weibo.com
// @noframes     true
// @run-at       document-idle
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(async function () {
    // 定时器集合
    const timerObject = {}

    $('.Main_full_1dfQX').on('click', '.woo-box-flex .head-info_info_2AspQ', async function () {
        if (gettextDom(this) === '中') return false

        const href = $(this).find('.head-info_time_6sFQg').attr('href')

        retextDom(this, '中')
        // const imgUrlList = getfileUrlByDom(this)
        const imgUrlList = await getfileUrlByInfo(this)
        if (imgUrlList.length <= 0) {
            retextDom(this, '失败，未找到图片资源', href)
            return false
        }

        const promiseList = imgUrlList.map(getFileBlob)
        const imageRes = await Promise.all(promiseList)
        retextDom(this, '结束（点击再次下载）', href)

        const writerName = $(this).prev().find('.head_name_24eEB').text()
        const time = $(this).find('.head-info_time_6sFQg').attr('title') || $(this).find('.head-info_time_6sFQg').text()
        pack(imageRes, `${writerName}${time}`, )

    })

    // 打包
    function pack(imageRes, modification) {
        var zip = new JSZip();
        imageRes.forEach(function (obj) {
            const suffixName = new URL(obj.finalUrl).pathname.match(/\.\w+$/)[0]
            const name = `${modification}-part${String(obj._id).padStart(2,'0')}${suffixName}`
            zip.file(name, obj._blob);
        });

        // 生成zip文件并下载
        zip.generateAsync({
            type: 'blob'
        }).then((content) => {
            GM_download({
                url: URL.createObjectURL(content),
                name: `${modification}.zip`,
            })
        })
    }

    // 下载
    function getFileBlob(url, index) {
        return new Promise((resolve, rejcet) => {
            GM_xmlhttpRequest({
                url,
                method: 'get',
                responseType: 'blob',
                headers: {
                    referer: 'https://weibo.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
                },
                onload: (res) => {
                    console.log(`getFileBlob-onload`, res)
                    resolve({
                        ...res,
                        _blob: res.response,
                        _id: index + 1
                    })
                },
                onerror: (res) => {
                    console.log(`getFileBlob-onerror`, res)
                    resolve(null)
                }
            })
        })
    }

    // 通过dom获取链接
    function getfileUrlByDom(dom) {
        const UrlList = []
        const $imgDomList = $(dom).parents('.Feed_body_3R0rO').find('.picture.content_row_-r5Tk .woo-picture-slot')

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
            UrlList.push(url)
        })
        return UrlList
    }

    // 通过id获取链接
    function getInfoById(id) {
        return new Promise((resolve, rejcet) => {
            GM_xmlhttpRequest({
                url: `https://weibo.com/ajax/statuses/show?id=${id}`,
                responseType: 'json',
                onload: (res) => {
                    console.log(`getInfoById-onload`, res)
                    resolve(res.response.pic_infos)
                },
                onerror: (res) => {
                    console.log(`getInfoById-onerror`, res)
                    resolve(null)
                }
            })
        })
    }

    // 获取图片链接
    async function getfileUrlByInfo(dom) {
        const idList = []
        $(dom).parents('.Feed_body_3R0rO').find('.head-info_time_6sFQg').each((index, item) => {
            idList.push($(item).attr('href').match(/(?<=\/)\w+$/)[0])
        })
        const resList = await Promise.all(idList.map(getInfoById))
        const urlList = []
        resList.forEach(item => {
            if (!item) return false;
            [...Object.keys(item)].forEach(ele => {
                urlList.push(item[ele].largest.url)
                if (item[ele].type === 'livephoto') {
                    urlList.push(item[ele].video)
                }
            })
        })
        return urlList
    }

    // dom修改文本
    function retextDom(dom, text, timer) {
        const $dom = $(dom)
        $dom.attr('show-text', text)
        if (timer) {
            timerObject[timer] && clearTimeout(timerObject[timer])
            timerObject[timer] = setTimeout(() => {
                $(`[href='${timer}']`).parent().attr('show-text', '')
            }, 2000)
        }
    }

    // 获取dom文本
    function gettextDom(dom, text) {
        return $(dom).attr('show-text')
    }

    GM_addStyle(`
    .woo-box-flex .head-info_info_2AspQ:after{content:"下载" attr(show-text);color:#ff8200;cursor:pointer}
      `)

    // debugJS
    unsafeWindow.$ = $
    // setTimeout(() => {
    // }, 5 * 1000);
})()