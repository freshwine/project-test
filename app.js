const menuItems = [
    { title: "西部走廊", data: "western_corridor" },
    { title: "三類場域", data: "third_category" },
    { title: "服務效率", data: "service_efficiency" },
];

const highlightCities = ["南投縣", "基隆市", "屏東縣", "宜蘭縣"];

function renderMenu() {
    
    const menu = document.getElementById("topMenu");
    const params = new URLSearchParams(window.location.search);
    const currentData = params.get("data") || "western_corridor";

    menuItems.forEach(item => {
        const a = document.createElement("a");
        a.innerText = item.title;
        a.href = `index.html?data=${item.data}`;

        if (item.data === currentData) {
            a.classList.add("active");
        }

        menu.appendChild(a);
    });
}

async function loadGzipJson(file) {

    const response = await fetch(file);
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const compressed = await response.arrayBuffer();
    const text = pako.inflate(
        new Uint8Array(compressed),
        { to: "string" }
    );

    return JSON.parse(text);
}

async function init() {
    renderMenu();
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data") || "western_corridor";
    const jsonFile = `data/${data}.json.gz`;
    const json = await loadGzipJson(jsonFile);
    renderTabs(data, json.tabs);
}

function renderTabs(fileName, tabGroups) {

    const tabsDiv = document.getElementById("tabs");
    const contentDiv = document.getElementById("content");

    let activePath = getDefaultPath(tabGroups);
    let openLevel = null;

    const cardCache = {};

    document.body.addEventListener("click", (e)=>{

        if(!tabsDiv.contains(e.target)){

            if(openLevel !== null){

                openLevel = null;
                renderTabBar();
            }

        }

    });

    function getDefaultPath(nodes){

        let path=[];
        let current=nodes;

        while(current){

            path.push(0);

            const node=current[0];

            if(!node.children){
                break;
            }

            current=node.children;
        }

        return path;
    }

    // 取得某個 path 對應的 node
    function getNodeByPath(path){

        let node=tabGroups[path[0]];

        for(let i=1;i<path.length;i++){

            if(!node || !node.children){
                return null;
            }

            node=node.children[path[i]];
        }

        return node;
    }

    // 父層切換後，盡量保留原本子層
    function preservePath(path){

        let result=[...path];
        let node=tabGroups[result[0]];

        for(let i=1;;i++){

            if(!node.children){
                break;
            }

            let index=result[i];

            // 原本 index 不存在
            if(
                index === undefined ||
                !node.children[index]
            ){
                const oldNode=getNodeByPath(activePath.slice(0,i+1));

                let newIndex=-1;

                // 嘗試找相同節點
                if(oldNode){

                    newIndex=node.children.findIndex(
                        item =>
                        (
                            item.id &&
                            oldNode.id &&
                            item.id===oldNode.id
                        )
                        ||
                        item.title===oldNode.title
                        ||
                        item.label===oldNode.label
                    );
                }

                // 找不到就第一個
                if(newIndex===-1){
                    newIndex=0;
                }

                result[i]=newIndex;
            }

            node=node.children[result[i]];
        }

        // 清除多餘層級
        return result.slice(
            0,
            getDepth(result)+1
        );
    }

    function getDepth(path){

        let node=tabGroups[path[0]];
        let depth=0;

        while(node && node.children){
            depth++;
            node=node.children[path[depth]];
        }

        return depth;
    }

    function getCurrentNode(){

        let node=tabGroups[activePath[0]];

        for(let i=1;i<activePath.length;i++){

            if(!node || !node.children){
                return null;
            }

            node=node.children[activePath[i]];
        }

        return node;
    }

    function getLevels(){

        let levels=[];
        let items=tabGroups;
        let depth=0;

        while(items){

            let index=activePath[depth] ?? 0;

            // 防止 index 超出
            if(!items[index]){                
                index=0;
                activePath[depth]=0;            
            }

            levels.push({
                depth:depth,
                items:items,
                active:index
            });

            const current=items[index];

            if(!current.children){
                break;
            }

            items=current.children;

            depth++;
        }

        // 移除不存在的尾端
        activePath=activePath.slice(
            0,
            levels.length
        );

        return levels;
    }

    function createDropdown(level){

        const wrap=document.createElement("div");
        wrap.className="tab-wrap";

        const btn=document.createElement("button");
        btn.className="tab-btn";

        const currentItem = level.items[level.active];

        if(openLevel !== level.depth){
            btn.classList.add("active");
        }

        btn.innerHTML =
            openLevel===level.depth
            ?
            `
            <span>${currentItem.label ?? currentItem.title}</span>
            <span>▲</span>
            `
            :
            `
            <span>${currentItem.title}</span>
            <span>▼</span>
            `;

        const menu=document.createElement("div");
        menu.className="menu";

        btn.onclick=(e)=>{
            e.stopPropagation();

            openLevel =
                openLevel===level.depth
                ? null
                : level.depth;

            renderTabBar();
        };

        if(openLevel===level.depth){

            menu.classList.add("show");

            level.items.forEach((item,index)=>{

                const div=document.createElement("div");
                div.className="item";
                div.innerText=item.title;

                div.onclick=(e)=>{

                    e.stopPropagation();

                    activePath[level.depth]=index;

                    // 保留子層
                    activePath =
                        preservePath(activePath);

                    openLevel=null;

                    renderTabBar();
                    renderContent();
                };

                menu.appendChild(div);
            });

        }

        wrap.appendChild(btn);
        wrap.appendChild(menu);

        return wrap;
    }

    function renderTabBar(){

        tabsDiv.innerHTML="";

        const tabBar=document.createElement("div");
        tabBar.className="tab-bar";

        const levels=getLevels();

        levels.forEach(level=>{
            tabBar.appendChild(
                createDropdown(level)
            );
        });


        const downloadGroup = document.createElement("button");
        downloadGroup.className = "download-csv";
        downloadGroup.type = "button";

        downloadGroup.innerHTML = `
            <img src="images/download.png" alt="下載">
        `;

        downloadGroup.onclick = () => {

            const node = getCurrentNode();

            if (!node || !node.id) {
                alert("找不到目前頁籤");
                return;
            }

            const zipFile = `data/${fileName}.zip`;

            downloadCsvFromZip(zipFile, node.id);
        };

        tabsDiv.appendChild(tabBar);
        tabsDiv.appendChild(downloadGroup);
    }

    function renderContent(){

        const node=getCurrentNode();

        if(!node){
            return;
        }

        const cacheKey=activePath.join("-");

        contentDiv.innerHTML="";

        const container=document.createElement("div");
        container.className="card-container";

        contentDiv.appendChild(container);

        if(cardCache[cacheKey]){

            renderCards(
                container,
                cardCache[cacheKey].cards,
                cardCache[cacheKey].is_percent,
                cardCache[cacheKey].level_type
            );

            return;
        }

        cardCache[cacheKey]={
            cards:node.cards,
            is_percent:node.is_percent,
            level_type:node.level_type
        };

        renderCards(
            container,
            node.cards,
            node.is_percent,
            node.level_type
        );
    }

    function render(){
        renderTabBar();
        renderContent();
    }

    render();
}


function renderCards(container, cards, isPercent, levelType = []) {

    const percentMode = isPercent;
    const levelMode = levelType;

    const existCols = [...new Set(cards.map(c => Number(c.grid_col)))].sort((a,b)=>a-b);
    const colMap = new Map(existCols.map((c,i)=>[c,i+1]));
    const columnWidth =
        existCols.length === 3 &&
        existCols.includes(1) &&
        existCols.includes(2) &&
        existCols.includes(3)
            ? 550
            : 650;

    container.style.gridTemplateColumns =
        `repeat(${existCols.length}, ${columnWidth}px)`;
        
    cards.forEach(card => {

        const div = document.createElement("div");
        div.className = "card";
        div.style.gridColumn = colMap.get(Number(card.grid_col));

        const toolbar = document.createElement("div");
        toolbar.className = "card-toolbar";

        div.appendChild(toolbar);

        /* ===== title ===== */
        const title = document.createElement("div");
        title.className = "title";
        title.innerText = card.title;
        title.style.background = card.bg_color;

        div.appendChild(title);

        let chart = null;

        /* ===== chart ===== */
        if (card.chart) {

            const wrapper = document.createElement("div");
            wrapper.className = "chart-wrapper";

            canvas = document.createElement("canvas");
            wrapper.appendChild(canvas);

            div.appendChild(wrapper);

            const annotations = {};

            card.chart.annotations?.forEach((item, i) => {

                annotations[`vline_${i}`] = {
                    type: "line",
                    xMin: item.year,
                    xMax: item.year,
                    borderColor: "#808080",
                    borderWidth: 3,
                    borderDash: [6, 2],
                    label: {
                        display: true,
                        content: item.text,
                        position: "start",
                        backgroundColor: "#000000b3",
                        color: "white"
                    },
                };
            });

            chart = new Chart(canvas, {
                type: card.chart.type,
                data: {
                    labels: card.chart.labels,
                    datasets: card.chart.datasets.map(ds => ({
                        ...ds,
                        maxBarThickness: 70
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    scales: {
                        x: {
                            stacked: card.chart.stacked
                        },
                        y: {
                            stacked: card.chart.stacked,
                            beginAtZero: levelMode !== "rate",

                            afterDataLimits(scale) {

                                if (levelMode === "rate") {

                                    const max = Math.max(
                                        Math.abs(scale.max),
                                        Math.abs(scale.min)
                                    );

                                    scale.min = -max;
                                    scale.max = max;
                                }
                            },

                            ticks: {
                                callback: function(value) {

                                    if (percentMode) {
                                        return (value * 100).toFixed(0) + "%";
                                    }

                                    return value.toLocaleString();
                                }
                            }
                        }
                    },

                    plugins: {
                        annotation: {
                            annotations
                        },

                        tooltip: {
                            callbacks: {
                                label: function(context) {

                                    let value = context.raw;

                                    if (percentMode) {
                                        return context.dataset.label + ": " +
                                            (value * 100).toFixed(2) + "%";
                                    }

                                    return context.dataset.label + ": " + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        }

        /* ===== table ===== */
        if (card.table) {

            const tableWrapper = document.createElement("div");
            tableWrapper.className = "table-wrapper";

            const buttons = createDownloadButtons(
                card.title, 
                card.table.columns, 
                card.table.rows, 
                chart
            );

            toolbar.appendChild(buttons);

            const table = document.createElement("table");

            /* header */
            const thead = document.createElement("thead");
            const trHead = document.createElement("tr");

            card.table.columns.forEach(col => {
                const th = document.createElement("th");
                th.innerText = col;
                trHead.appendChild(th);
            });

            thead.appendChild(trHead);
            table.appendChild(thead);

            /* body */
            const tbody = document.createElement("tbody");

            card.table.rows.forEach(row => {
                const tr = document.createElement("tr");

                card.table.columns.forEach(col => {
                    const td = document.createElement("td");
                    let value = row[col];

                    setCellStyle(td, col, value, levelMode, percentMode, "#ffffff");
                    
                    tr.appendChild(td);
                });

                tbody.appendChild(tr);
            });

            table.appendChild(tbody);

            table.classList.add("scroll");

            tableWrapper.appendChild(table);
            div.appendChild(tableWrapper);

            requestAnimationFrame(() => {

                if (table.scrollWidth <= tableWrapper.clientWidth) {
                    table.classList.remove("scroll");
                    table.classList.add("fit");
                }

            });
        }

        /* ===== matrices ===== */
        if (card.matrices) {

            const buttons = createMatricesDownloadButton(
                card.title,
                card.matrices
            );

            toolbar.appendChild(buttons);

            const MAX_VISIBLE_MATRICES = 1;

            const visibleMatrices = card.matrices.slice(0, MAX_VISIBLE_MATRICES);
            const hiddenMatrices = card.matrices.slice(MAX_VISIBLE_MATRICES);

            const container = document.createElement("div");
            div.appendChild(container);

            // 先定義，避免 hoisting 混亂
            function renderMatrix(matrix, levelMode, percentMode) {

                const block = document.createElement("div");
                block.className = "matrix-block";

                const title = document.createElement("div");
                title.className = "matrix-title";
                title.innerText = matrix.name;

                block.appendChild(title);

                const tableWrapper = document.createElement("div");
                tableWrapper.className = "table-wrapper";

                const table = document.createElement("table");

                const thead = document.createElement("thead");
                const trHead = document.createElement("tr");

                matrix.columns.forEach(col => {
                    const th = document.createElement("th");
                    th.innerText = col;

                    if (highlightCities.includes(col)) {
                        th.style.backgroundColor = "#FFE699";
                    }

                    trHead.appendChild(th);
                });

                thead.appendChild(trHead);
                table.appendChild(thead);

                const tbody = document.createElement("tbody");

                matrix.rows.forEach(row => {
                    const tr = document.createElement("tr");

                    matrix.columns.forEach(col => {
                        const td = document.createElement("td");
                        let value = row[col];

                        setCellStyle(td, col, value, levelMode, percentMode, "#A9CD78");

                        tr.appendChild(td);
                    });

                    tbody.appendChild(tr);
                });

                table.appendChild(tbody);
                tableWrapper.appendChild(table);
                block.appendChild(tableWrapper);

                return block;
            }

            // 1. 先 render 可見
            visibleMatrices.forEach(m => {
                container.appendChild(renderMatrix(m, levelMode, percentMode));
            });

            // 2. lazy render hidden
            if (hiddenMatrices.length > 0) {

                const btn = document.createElement("button");
                btn.className = "matrix-more-btn";
                btn.innerText = `載入更多 (${hiddenMatrices.length})`;

                btn.onclick = () => {

                    let i = 0;

                    function loadNext() {
                        if (i >= hiddenMatrices.length) {
                            btn.remove();
                            return;
                        }

                        container.appendChild(
                            renderMatrix(hiddenMatrices[i], levelMode, percentMode)
                        );

                        i++;

                        requestAnimationFrame(loadNext);
                    }

                    loadNext();
                    btn.remove();
                };

                div.appendChild(btn);
            }

        }

        container.appendChild(div);
    });
}

function setCellStyle(td, col, value, levelMode, percentMode, nullBgColor = "#A9CD78") {
    
    if (col === "年度" || col === "" || col === "縣市") {
        td.innerText = value;

        if (highlightCities.includes(col) || highlightCities.includes(value)) {
            td.style.backgroundColor = "#FFE699";
        }

        return;
    }

    if (levelMode === "total") {
        if (value == null) td.style.backgroundColor = nullBgColor;
        else if (value === 0) td.style.backgroundColor = "#def0ef";
        else if (value < 1000) td.style.backgroundColor = "#CECFE6";
        else if (value < 10000) td.style.backgroundColor = "#F4E380";
        else if (value < 100000) td.style.backgroundColor = "#F8A55A";
        else td.style.backgroundColor = "#F16B42";
    } 
    else if (levelMode === "rate") {
        if (value == null) td.style.backgroundColor = nullBgColor;
        else if (value < 0.01) td.style.backgroundColor = "#CECFE6";
        else if (value < 0.03) td.style.backgroundColor = "#F4E380";
        else if (value < 0.1) td.style.backgroundColor = "#F8A55A";
        else td.style.backgroundColor = "#F16B42";
    } 
    else if (levelMode === "percentage") {
        if (value == null) td.style.backgroundColor = nullBgColor;
        else if (value < 0.25) td.style.backgroundColor = "#CECFE6";
        else if (value < 0.5) td.style.backgroundColor = "#F4E380";
        else if (value < 0.75) td.style.backgroundColor = "#F8A55A";
        else td.style.backgroundColor = "#F16B42";
    } 
    else if (levelMode === "length") {
        if (value == null) td.style.backgroundColor = nullBgColor;
        else if (value <= 20) td.style.backgroundColor = "#CECFE6";
        else if (value < 100) td.style.backgroundColor = "#F4E380";
        else if (value < 200) td.style.backgroundColor = "#F8A55A";
        else td.style.backgroundColor = "#F16B42";
    }

    if (value == null) {
        td.innerText = "";
    } 
    else if (percentMode && typeof value === "number") {
        td.innerText = (value * 100).toFixed(2) + "%";
    } 
    else if (typeof value === "number") {
        td.innerText = Number(value).toLocaleString();
    } 
    else {
        td.innerText = value;
    }
}

async function downloadCsvFromZip(zipFile, tabId) {

    // tab{id} -> id
    const match = tabId.match(/\d+$/);

    if (!match) {
        alert("tab id 格式錯誤");
        return;
    }

    const id = match[0];
    const response = await fetch(zipFile);
    const buffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    // 找最後為 _{id}.csv 的檔案
    const file = Object.values(zip.files).find(file =>
        file.name.endsWith(`_${id}.csv`)
    );

    if (!file) {
        alert("找不到對應 CSV");
        return;
    }

    const blob = await file.async("blob");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = file.name
        .replace(/^[^_]+_/, "")
        .replace(/_\d+\.csv$/, ".csv");
    a.click();

    URL.revokeObjectURL(url);
}

function downloadCSV(filename, columns, rows) {

    let csv = [];
    csv.push(columns.join(","));

    rows.forEach(row => {
        const rowData = columns.map(col => {
            let value = row[col];
            if (value == null) return "";
            return `"${value}"`;
        });

        csv.push(rowData.join(","));
    });

    const blob = new Blob(
        [csv.join("\n")],
        { type: "text/csv;charset=utf-8;" }
    );

    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = filename + ".csv";
    link.click();
}

function downloadExcel(filename, columns, rows) {

    const worksheetData = [
        columns,
        ...rows.map(row =>
            columns.map(col => row[col])
        )
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    Object.keys(ws).forEach(cell => {
        if (cell.startsWith("!")) return;

        const value = ws[cell];

        if (value && typeof value.v === "number") {
            value.z = "#,##0";
        }
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    XLSX.writeFile(wb, filename + ".xlsx");
}

function downloadChart(filename, chart) {

    if (document.querySelector(".png-dialog-mask")) {
        return;
    }

    const dialog = document.createElement("div");

    dialog.innerHTML = `
    <div class="png-dialog-mask">
        <div class="png-dialog">

            <div class="png-dialog-title">
                匯出圖片
            </div>

            <div class="png-dialog-row">
                <label>寬度</label>
                <input id="pngWidth" type="number" value="628">
                <span>px</span>
            </div>

            <div class="png-dialog-row">
                <label>高度</label>
                <input id="pngHeight" type="number" value="350">
                <span>px</span>
            </div>

            <div class="png-dialog-buttons">
                <button id="pngCancel">取消</button>
                <button id="pngOK">下載</button>
            </div>

        </div>
    </div>
    `;

    document.body.appendChild(dialog);
    document.getElementById("pngOK").onclick = () => {
        const width = Number(
            document.getElementById("pngWidth").value
        );
        const height = Number(
            document.getElementById("pngHeight").value
        );

        if (!width || !height) return;

        // 建立下載用 canvas
        const exportCanvas = document.createElement("canvas");

        exportCanvas.width = width;
        exportCanvas.height = height;

        // 複製資料
        const data = structuredClone(
            chart.config.data
        );

        // options 複製（避免 Chart instance clone）
        const options = {
            ...chart.config.options,

            responsive: false,
            maintainAspectRatio: false,
            animation: false,
            devicePixelRatio: 3
        };

        // 重新建立 Chart
        const exportChart = new Chart(
            exportCanvas,
            {
                type: chart.config.type,
                data: data,
                options: options
            }
        );

        // 等 Chart.js render 完
        setTimeout(()=>{

            const link = document.createElement("a");

            link.download = filename + ".png";
            link.href = exportCanvas.toDataURL(
                "image/png"
            );
            link.click();            
            exportChart.destroy();
            dialog.remove();

        },100);

    };

    document.getElementById("pngCancel").onclick = () => {
        dialog.remove();
    };

}

function createDownloadButtons(filename, columns, rows, canvas) {
    console.log("download canvas:", canvas);

    const wrapper = document.createElement("div");
    wrapper.className = "download-group";

    // CSV
    const csvBtn = document.createElement("button");
    csvBtn.innerText = "CSV";

    csvBtn.onclick = () => {
        downloadCSV(filename, columns, rows);
    };

    // Excel
    const excelBtn = document.createElement("button");
    excelBtn.innerText = "Excel";

    excelBtn.onclick = () => {
        downloadExcel(filename, columns, rows);
    };

    // PNG
    const pngBtn = document.createElement("button");
    pngBtn.innerText = "PNG";

    pngBtn.onclick = () => {
        downloadChart(filename, canvas);
    };

    wrapper.appendChild(csvBtn);
    wrapper.appendChild(excelBtn);
    wrapper.appendChild(pngBtn);

    return wrapper;
}

function downloadMatricesExcel(filename, matrices) {

    const wb = XLSX.utils.book_new();

    matrices.forEach((matrix, index) => {

        const data = [
            matrix.columns,
            ...matrix.rows.map(row =>
                matrix.columns.map(col => row[col])
            )
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);

        // Sheet 名稱最多 31 字元
        const sheetName =
            (matrix.name || `Matrix${index + 1}`)
            .substring(0, 31);

        XLSX.utils.book_append_sheet(
            wb,
            ws,
            sheetName
        );
    });

    XLSX.writeFile(wb, filename + ".xlsx");
}

function createMatricesDownloadButton(filename, matrices) {

    const wrapper = document.createElement("div");
    wrapper.className = "download-group";

    const excelBtn = document.createElement("button");
    excelBtn.innerText = "Excel";

    excelBtn.onclick = () => {
        downloadMatricesExcel(filename, matrices);
    };

    wrapper.appendChild(excelBtn);

    return wrapper;
}

init();
