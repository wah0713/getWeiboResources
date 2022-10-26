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
// @match        *://weibo.com/u/*
// @noframes     true
// @run-at       document-idle
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    let vueRecycleScrollerDom = $('.Main_full_1dfQX')
    vueRecycleScrollerDom.on('click', '.head-info_info_2AspQ', function () {
        const $imgDomList = $(this).parents('.Feed_body_3R0rO').find('.picture.content_row_-r5Tk img')
        $imgDomList.each((index, item) => {
            console.log(`item`, item)
            const a = item.src.replace(/(?<=(cn)\/).+(?=(\/))/, 'large')
            console.log(`a`, a)
        })
    })

    GM_addStyle(``)
    // // debugJS
    // setTimeout(() => {
    // }, 5 * 1000);
})()