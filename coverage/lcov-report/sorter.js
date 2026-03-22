/* eslint-disable */
var addSorting = (function() {
    'use strict';
    var cols,
        currentSort = {
            index: 0,
            desc: false
        };

    /**
     * Locate the coverage summary table element in the document.
     * @returns {HTMLTableElement|null} The first element matching `.coverage-summary`, or `null` if none exists.
     */
    function getTable() {
        return document.querySelector('.coverage-summary');
    }
    /**
     * Locate the header row inside the coverage summary table's thead.
     * @returns {HTMLTableRowElement|null} The header `<tr>` element from the summary table's `<thead>`, or `null` if not found.
     */
    function getTableHeader() {
        return getTable().querySelector('thead tr');
    }
    /**
     * Get the tbody element of the coverage summary table.
     * @returns {HTMLTableSectionElement|null} The table body (`tbody`) element for `.coverage-summary`, or `null` if none exists.
     */
    function getTableBody() {
        return getTable().querySelector('tbody');
    }
    /**
     * Retrieve the header cell for the nth column in the coverage summary table.
     * @param {number} n - Zero-based index of the column.
     * @returns {HTMLTableHeaderCellElement|undefined} The `th` element for that column, or `undefined` if no such column exists.
     */
    function getNthColumn(n) {
        return getTableHeader().querySelectorAll('th')[n];
    }

    /**
     * Filter rows in the first <tbody> using the value of the file search input.
     *
     * Reads the current value of the input with id `fileSearch` and, for each row
     * in the first `<tbody>` in the document, clears `row.style.display` when the
     * row's text content contains the search string (case-insensitive) or sets
     * `row.style.display = 'none'` when it does not.
     */
    function onFilterInput() {
        const searchValue = document.getElementById('fileSearch').value;
        const rows = document.getElementsByTagName('tbody')[0].children;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (
                row.textContent
                    .toLowerCase()
                    .includes(searchValue.toLowerCase())
            ) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    }

    /**
     * Inserts the file search UI into the page and wires its input to the filter handler.
     *
     * Clones the <template id="filterTemplate"> content, sets the cloned element with id "fileSearch"
     * to call onFilterInput on input events, and appends the clone to the template's parent element.
     */
    function addSearchBox() {
        var template = document.getElementById('filterTemplate');
        var templateClone = template.content.cloneNode(true);
        templateClone.getElementById('fileSearch').oninput = onFilterInput;
        template.parentElement.appendChild(templateClone);
    }

    /**
     * Collects metadata for each header cell in the coverage summary table and appends a sorter element to sortable headers.
     *
     * @returns {Array<Object>} An array of column metadata objects. Each object contains:
     *  - `key` (string): value of the header cell's `data-col` attribute.
     *  - `sortable` (boolean): `true` if the column is sortable (no `data-nosort` attribute), `false` otherwise.
     *  - `type` (string): the column data type from `data-type`, defaults to `"string"`.
     *  - `defaultDescSort` (boolean, optional): present for sortable columns and `true` when `type` is `"number"`, indicating the default sort direction.
     */
    function loadColumns() {
        var colNodes = getTableHeader().querySelectorAll('th'),
            colNode,
            cols = [],
            col,
            i;

        for (i = 0; i < colNodes.length; i += 1) {
            colNode = colNodes[i];
            col = {
                key: colNode.getAttribute('data-col'),
                sortable: !colNode.getAttribute('data-nosort'),
                type: colNode.getAttribute('data-type') || 'string'
            };
            cols.push(col);
            if (col.sortable) {
                col.defaultDescSort = col.type === 'number';
                colNode.innerHTML =
                    colNode.innerHTML + '<span class="sorter"></span>';
            }
        }
        return cols;
    }
    // attaches a data attribute to every tr element with an object
    /**
     * Builds an object of cell values for a table row keyed by column name.
     * 
     * Each property key is the column's `key` from the header metadata. Cell values
     * are taken from each td's `data-value` attribute; values for columns typed as
     * `number` are converted to JavaScript numbers.
     * @param {HTMLTableRowElement} tableRow - The table row (<tr>) to read cell values from.
     * @returns {Object.<string, (string|number)>} An object mapping column keys to their cell values.
     */
    function loadRowData(tableRow) {
        var tableCols = tableRow.querySelectorAll('td'),
            colNode,
            col,
            data = {},
            i,
            val;
        for (i = 0; i < tableCols.length; i += 1) {
            colNode = tableCols[i];
            col = cols[i];
            val = colNode.getAttribute('data-value');
            if (col.type === 'number') {
                val = Number(val);
            }
            data[col.key] = val;
        }
        return data;
    }
    /**
     * Populate each table body row's `data` property with an object that maps column keys to their cell values.
     *
     * Each row's `data` object contains parsed cell values (numeric columns converted to numbers) for use during sorting.
     */
    function loadData() {
        var rows = getTableBody().querySelectorAll('tr'),
            i;

        for (i = 0; i < rows.length; i += 1) {
            rows[i].data = loadRowData(rows[i]);
        }
    }
    /**
     * Reorders the coverage summary table rows using values from the specified column.
     *
     * Sorts the <tbody> of the table with class "coverage-summary" by each row's value for the column at `index` and updates the DOM order.
     * @param {number} index - Zero-based index of the column to sort by.
     * @param {boolean} desc - If `true`, sort in descending order; otherwise sort ascending.
     */
    function sortByIndex(index, desc) {
        var key = cols[index].key,
            sorter = function(a, b) {
                a = a.data[key];
                b = b.data[key];
                return a < b ? -1 : a > b ? 1 : 0;
            },
            finalSorter = sorter,
            tableBody = document.querySelector('.coverage-summary tbody'),
            rowNodes = tableBody.querySelectorAll('tr'),
            rows = [],
            i;

        if (desc) {
            finalSorter = function(a, b) {
                return -1 * sorter(a, b);
            };
        }

        for (i = 0; i < rowNodes.length; i += 1) {
            rows.push(rowNodes[i]);
            tableBody.removeChild(rowNodes[i]);
        }

        rows.sort(finalSorter);

        for (i = 0; i < rows.length; i += 1) {
            tableBody.appendChild(rows[i]);
        }
    }
    /**
     * Clear sort-related CSS classes from the currently active column header.
     *
     * Removes the `sorted` and `sorted-desc` class suffixes from the header cell
     * corresponding to `currentSort.index`, updating its `className`.
     */
    function removeSortIndicators() {
        var col = getNthColumn(currentSort.index),
            cls = col.className;

        cls = cls.replace(/ sorted$/, '').replace(/ sorted-desc$/, '');
        col.className = cls;
    }
    /**
     * Update the current column header's CSS class to indicate the active sort direction.
     *
     * Appends either " sorted-desc" (for descending) or " sorted" (for ascending) to the header cell's class list for the column identified by `currentSort.index`.
     */
    function addSortIndicators() {
        getNthColumn(currentSort.index).className += currentSort.desc
            ? ' sorted-desc'
            : ' sorted';
    }
    /**
     * Attach click handlers to each sortable column header to enable interactive sorting.
     *
     * For every column marked sortable, adds a click listener on the header area that sorts the table by that column, toggles ascending/descending when the same column is clicked again, and updates visual sort indicators and the module's current sort state.
     */
    function enableUI() {
        var i,
            el,
            ithSorter = function ithSorter(i) {
                var col = cols[i];

                return function() {
                    var desc = col.defaultDescSort;

                    if (currentSort.index === i) {
                        desc = !currentSort.desc;
                    }
                    sortByIndex(i, desc);
                    removeSortIndicators();
                    currentSort.index = i;
                    currentSort.desc = desc;
                    addSortIndicators();
                };
            };
        for (i = 0; i < cols.length; i += 1) {
            if (cols[i].sortable) {
                // add the click event handler on the th so users
                // dont have to click on those tiny arrows
                el = getNthColumn(i).querySelector('.sorter').parentElement;
                if (el.addEventListener) {
                    el.addEventListener('click', ithSorter(i));
                } else {
                    el.attachEvent('onclick', ithSorter(i));
                }
            }
        }
    }
    // adds sorting functionality to the UI
    return function() {
        if (!getTable()) {
            return;
        }
        cols = loadColumns();
        loadData();
        addSearchBox();
        addSortIndicators();
        enableUI();
    };
})();

window.addEventListener('load', addSorting);
