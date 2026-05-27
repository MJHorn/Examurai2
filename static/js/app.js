// --- Examurai Core Javascript Controller ---

document.addEventListener('DOMContentLoaded', () => {
    
    // --- STATE MANAGEMENT ---
    const state = {
        activeTab: 'import',
        exams: [],
        currentExamId: '',
        questions: [],
        currentQuestion: null,
        searchQuery: '',
        searchTag: '',
        allTags: {}, // unique tag -> count
        selectedQuestionIds: [], // Track multiselect bulk questions
        classes: [],             // Classes loaded
        currentClassId: '',      // Active class
        worksheetQueue: []       // Worksheet Builder queue
    };

    // --- DOM ELEMENT REFERENCES ---
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    // Tab 1: Import Center
    const dropZone = document.getElementById('drop-zone');
    const pdfFileInput = document.getElementById('pdf-file-input');
    const uploadLoader = document.getElementById('upload-loader');
    const examsList = document.getElementById('exams-list');
    
    // Tab 2: Question Tagger
    const taggingExamSelect = document.getElementById('tagging-exam-select');
    const questionsListContainer = document.getElementById('questions-list-container');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnSelectNone = document.getElementById('btn-select-none');
    const taggerEmptyState = document.getElementById('tagger-empty-state');
    const taggerActivePanel = document.getElementById('tagger-active-panel');
    const taggerBulkPanel = document.getElementById('tagger-bulk-panel');
    
    const taggerBadgeSection = document.getElementById('tagger-badge-section');
    const taggerTitle = document.getElementById('tagger-title');
    const taggerBadgeMarks = document.getElementById('tagger-badge-marks');
    const taggerPagesIndicator = document.getElementById('tagger-pages-indicator');
    const taggerActiveTags = document.getElementById('tagger-active-tags');
    const customTagInput = document.getElementById('custom-tag-input');
    const btnAddCustomTag = document.getElementById('btn-add-custom-tag');
    const taggerSuggestedTags = document.getElementById('tagger-suggested-tags');
    const taggerCanvas = document.getElementById('tagger-canvas');
    const taggerClassChecklist = document.getElementById('tagger-class-checklist');
    
    // Bulk tagger DOM items
    const bulkSelectedCount = document.getElementById('bulk-selected-count');
    const btnClearBulk = document.getElementById('btn-clear-bulk');
    const bulkSelectedQuestionsGrid = document.getElementById('bulk-selected-questions-grid');
    const bulkTagInput = document.getElementById('bulk-tag-input');
    const btnBulkAddTag = document.getElementById('btn-bulk-add-tag');
    const bulkRemoveTagInput = document.getElementById('bulk-remove-tag-input');
    const btnBulkRemoveTag = document.getElementById('btn-bulk-remove-tag');
    const bulkExistingTagsSection = document.getElementById('bulk-existing-tags-section');
    const bulkExistingTagsList = document.getElementById('bulk-existing-tags-list');
    
    // Tab 4: Class Tracker DOM elements
    const classNameInput = document.getElementById('class-name-input');
    const btnAddClass = document.getElementById('btn-add-class');
    const classesListContainer = document.getElementById('classes-list-container');
    const classesEmptyState = document.getElementById('classes-empty-state');
    const classesActivePanel = document.getElementById('classes-active-panel');
    const classTrackerTitle = document.getElementById('class-tracker-title');
    const classExamSelect = document.getElementById('class-exam-select');
    const btnDeleteClass = document.getElementById('btn-delete-class');
    const classSeenStats = document.getElementById('class-seen-stats');
    const classQuestionsChecklistGrid = document.getElementById('class-questions-checklist-grid');
    
    // Adjust Layout drawer
    const btnToggleAdjust = document.getElementById('btn-toggle-adjust');
    const adjustDrawer = document.getElementById('adjust-drawer');
    const adjustForm = document.getElementById('adjust-form');
    const adjSection = document.getElementById('adj-section');
    const adjNumber = document.getElementById('adj-number');
    const adjMarks = document.getElementById('adj-marks');
    const adjPages = document.getElementById('adj-pages');
    const adjText = document.getElementById('adj-text');
    const btnCancelAdjust = document.getElementById('btn-cancel-adjust');
    
    // Tab 3: Tag Library Search
    const librarySearchInput = document.getElementById('library-search-input');
    const libraryTagCloud = document.getElementById('library-tag-cloud');
    const searchResultsGrid = document.getElementById('search-results-grid');
    const libraryClassSelect = document.getElementById('library-class-select');
    const librarySeenSelect = document.getElementById('library-seen-select');
    
    // Modal Details Overlay
    const questionModal = document.getElementById('question-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const modalExamTitle = document.getElementById('modal-exam-title');
    const modalBadgeSection = document.getElementById('modal-badge-section');
    const modalQTitle = document.getElementById('modal-q-title');
    const modalBadgeMarks = document.getElementById('modal-badge-marks');
    const modalTextContent = document.getElementById('modal-text-content');
    const modalTagsList = document.getElementById('modal-tags-list');
    const modalCanvas = document.getElementById('modal-canvas');
    const modalClassesSeenList = document.getElementById('modal-classes-seen-list');

    // Worksheet Builder Drawer Elements
    const worksheetBasketLauncher = document.getElementById('worksheet-basket-launcher');
    const worksheetBasketBadge = document.getElementById('worksheet-basket-badge');
    const builderDrawerOverlay = document.getElementById('builder-drawer-overlay');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const worksheetTitleInput = document.getElementById('worksheet-title-input');
    const worksheetSubtitleInput = document.getElementById('worksheet-subtitle-input');
    const btnClearBasket = document.getElementById('btn-clear-basket');
    const builderQueueList = document.getElementById('builder-queue-list');
    const btnCompileWorksheet = document.getElementById('btn-compile-worksheet');
    const compileLoader = document.getElementById('compile-loader');
    const compileLoaderText = document.getElementById('compile-loader-text');
    const btnTaggerWorksheetToggle = document.getElementById('btn-tagger-worksheet-toggle');
    const btnModalWorksheetToggle = document.getElementById('btn-modal-worksheet-toggle');



    // --- ROUTING / TAB INTERACTION ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    function switchTab(tabId) {
        state.activeTab = tabId;
        
        // Update Sidebar active state
        navItems.forEach(item => {
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Toggle Panels
        tabPanels.forEach(panel => {
            if (panel.id === `tab-${tabId}`) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });

        // Trigger loading behaviors for specific tabs
        if (tabId === 'tagging') {
            loadExamsForTagger();
        } else if (tabId === 'search') {
            refreshSearchLibrary();
        } else if (tabId === 'classes') {
            loadClassesTracker();
        }
    }


    // --- SEARCH HIGHLIGHT HELPERS ---
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function highlightKeyword(text, keyword) {
        if (!text) return '';
        if (!keyword || !keyword.trim()) return escapeHTML(text);
        const escapedKeyword = keyword.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedKeyword})`, 'gi');
        return escapeHTML(text).replace(regex, '<mark class="search-highlight">$1</mark>');
    }


    // --- API CORE CLIENTS ---
    async function apiRequest(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Server error occurred');
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            alert(`Error: ${error.message}`);
            return null;
        }
    }


    // --- TAB 1: IMPORT CENTER ---
    async function refreshExamsList() {
        const exams = await apiRequest('/api/exams');
        if (!exams) return;
        state.exams = exams;
        
        if (exams.length === 0) {
            examsList.innerHTML = `
                <div class="empty-state">
                    <p>No exams imported yet. Drag and drop a VCE PDF to start study segmenting.</p>
                </div>
            `;
            return;
        }

        examsList.innerHTML = exams.map(exam => `
            <div class="exam-item">
                <div class="exam-info">
                    <h4>${exam.title}</h4>
                    <div class="exam-meta">
                        <span>
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/>
                            </svg>
                            ${exam.num_pages} Pages
                        </span>
                        <span>
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>
                            </svg>
                            ${exam.num_questions} Questions
                        </span>
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm btn-select-exam" data-id="${exam.id}">
                    Select Exam
                </button>
            </div>
        `).join('');

        // Attach event listeners to select buttons
        document.querySelectorAll('.btn-select-exam').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const examId = btn.getAttribute('data-id');
                state.currentExamId = examId;
                switchTab('tagging');
            });
        });
    }

    // Drag & Drop Handlers
    dropZone.addEventListener('click', () => pdfFileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-purple)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            uploadFile(files[0]);
        } else {
            alert('Please drop a valid PDF exam file.');
        }
    });

    pdfFileInput.addEventListener('change', () => {
        if (pdfFileInput.files.length > 0) {
            uploadFile(pdfFileInput.files[0]);
        }
    });

    async function uploadFile(file) {
        uploadLoader.style.display = 'flex';
        
        const formData = new FormData();
        formData.append('file', file);

        const result = await apiRequest('/api/import', {
            method: 'POST',
            body: formData
        });

        uploadLoader.style.display = 'none';
        pdfFileInput.value = ''; // Reset input

        if (result && result.success) {
            alert(`Successfully imported: ${result.exam.title}!`);
            refreshExamsList();
        }
    }


    // --- TAB 2: QUESTION TAGGER ---
    async function loadExamsForTagger() {
        const exams = await apiRequest('/api/exams');
        if (!exams) return;
        state.exams = exams;

        if (exams.length === 0) {
            taggingExamSelect.innerHTML = `<option value="">-- No Exams Available --</option>`;
            questionsListContainer.innerHTML = '';
            showTaggerEmptyState();
            return;
        }

        taggingExamSelect.innerHTML = exams.map(exam => `
            <option value="${exam.id}" ${exam.id === state.currentExamId ? 'selected' : ''}>${exam.title}</option>
        `).join('');

        // If no exam selected, pick the first one
        if (!state.currentExamId) {
            state.currentExamId = exams[0].id;
        }

        taggingExamSelect.value = state.currentExamId;
        await loadQuestionsForExam(state.currentExamId);
    }

    taggingExamSelect.addEventListener('change', async (e) => {
        state.currentExamId = e.target.value;
        await loadQuestionsForExam(state.currentExamId);
    });

    async function loadQuestionsForExam(examId) {
        if (!examId) return;
        
        const examDetails = await apiRequest(`/api/exams/${examId}/questions`);
        if (!examDetails) return;
        state.questions = examDetails.questions;
        state.selectedQuestionIds = []; // Reset multiselect
        let lastCheckedIdx = -1;

        questionsListContainer.innerHTML = state.questions.map(q => {
            const tagsHtml = q.tags && q.tags.length > 0 
                ? q.tags.map(t => `<span class="q-nav-tag" data-tag="${t}" data-qid="${q.id}">#${t}<span class="q-nav-tag-remove" data-tag="${t}" data-qid="${q.id}">&times;</span></span>`).join('') 
                : '<span class="q-nav-tag untagged">#untagged</span>';
                
            return `
                <div class="q-nav-item-row" data-qid="${q.id}">
                    <label class="q-checkbox-container" style="align-self: center;">
                        <input type="checkbox" class="q-select-checkbox" data-qid="${q.id}">
                        <span class="q-checkbox-checkmark"></span>
                    </label>
                    <button class="q-nav-item" data-qid="${q.id}" style="align-items: center; justify-content: space-between; padding: 10px 12px; min-height: 52px; height: auto;">
                        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 6px; width: 100%; min-width: 0; text-align: left;">
                            <div class="q-nav-name">${q.section} Q${q.number}</div>
                            <div class="q-nav-tags-row" style="display: flex; flex-wrap: wrap; gap: 4px; width: 100%;">
                                ${tagsHtml}
                            </div>
                        </div>
                        <div class="q-nav-badge" style="margin-left: 6px;">${q.marks} mk</div>
                    </button>
                </div>
            `;
        }).join('');

        // Attach tag removal events from sidebar pills
        document.querySelectorAll('.q-nav-tag-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Avoid selectQuestion click
                const qid = btn.getAttribute('data-qid');
                const tag = btn.getAttribute('data-tag');
                await removeTagFromQuestionDirect(qid, tag);
            });
        });

        // Attach listeners to question select buttons (exclusive select)
        document.querySelectorAll('.q-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const qid = btn.getAttribute('data-qid');
                
                // Clear bulk selections and check only this one
                state.selectedQuestionIds = [qid];
                document.querySelectorAll('.q-select-checkbox').forEach((cb, idx) => {
                    const isTarget = (cb.getAttribute('data-qid') === qid);
                    cb.checked = isTarget;
                    if (isTarget) {
                        lastCheckedIdx = idx; // Set range start to this checkbox!
                    }
                });
                
                updateBulkSelectionState();
            });
        });

        // Attach listeners to checkboxes with Shift-Click range support
        const checkboxes = document.querySelectorAll('.q-select-checkbox');
        checkboxes.forEach((cb, idx) => {
            cb.addEventListener('click', (e) => {
                const qid = cb.getAttribute('data-qid');
                
                if (e.shiftKey && lastCheckedIdx !== -1) {
                    const start = Math.min(lastCheckedIdx, idx);
                    const end = Math.max(lastCheckedIdx, idx);
                    const isChecked = cb.checked; // match currently clicked state
                    
                    for (let i = start; i <= end; i++) {
                        checkboxes[i].checked = isChecked;
                        const itemQid = checkboxes[i].getAttribute('data-qid');
                        if (isChecked) {
                            if (!state.selectedQuestionIds.includes(itemQid)) {
                                state.selectedQuestionIds.push(itemQid);
                            }
                        } else {
                            state.selectedQuestionIds = state.selectedQuestionIds.filter(id => id !== itemQid);
                        }
                    }
                } else {
                    // Normal checkbox click
                    if (cb.checked) {
                        if (!state.selectedQuestionIds.includes(qid)) {
                            state.selectedQuestionIds.push(qid);
                        }
                    } else {
                        state.selectedQuestionIds = state.selectedQuestionIds.filter(id => id !== qid);
                    }
                    lastCheckedIdx = idx;
                }
                
                updateBulkSelectionState();
            });
        });

        // Restore active question selection if possible
        if (state.currentQuestion) {
            const found = state.questions.find(q => q.id === state.currentQuestion.id);
            if (found) {
                state.selectedQuestionIds = [found.id];
                updateBulkSelectionState();
                return;
            }
        }
        
        showTaggerEmptyState();
    }

    function showTaggerEmptyState() {
        taggerEmptyState.style.display = 'flex';
        taggerActivePanel.style.display = 'none';
        taggerBulkPanel.style.display = 'none';
        state.currentQuestion = null;
    }

    function updateBulkSelectionState() {
        const count = state.selectedQuestionIds.length;
        
        // Remove active/checked styles on all list rows
        document.querySelectorAll('.q-nav-item-row').forEach(row => {
            const qid = row.getAttribute('data-qid');
            const cb = row.querySelector('.q-select-checkbox');
            if (state.selectedQuestionIds.includes(qid)) {
                row.classList.add('checked');
                if (cb) cb.checked = true;
            } else {
                row.classList.remove('checked');
                if (cb) cb.checked = false;
            }
        });

        // Set active question button styling in sidebar
        document.querySelectorAll('.q-nav-item').forEach(btn => {
            const qid = btn.getAttribute('data-qid');
            if (count === 1 && state.selectedQuestionIds.includes(qid)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (count === 0) {
            // No selection
            taggerEmptyState.style.display = 'flex';
            taggerActivePanel.style.display = 'none';
            taggerBulkPanel.style.display = 'none';
            state.currentQuestion = null;
        } else if (count === 1) {
            // Single selection
            taggerEmptyState.style.display = 'none';
            taggerActivePanel.style.display = 'grid';
            taggerBulkPanel.style.display = 'none';
            
            const qid = state.selectedQuestionIds[0];
            selectQuestion(qid);
        } else {
            // Multi-selection (Bulk mode)
            taggerEmptyState.style.display = 'none';
            taggerActivePanel.style.display = 'none';
            taggerBulkPanel.style.display = 'flex';
            state.currentQuestion = null;

            // Update bulk count display
            bulkSelectedCount.textContent = `${count} questions selected`;

            // Render bulk list pills
            const selectedQuestions = state.questions.filter(q => state.selectedQuestionIds.includes(q.id));
            bulkSelectedQuestionsGrid.innerHTML = selectedQuestions.map(q => `
                <span class="bulk-q-pill">${q.section} Q${q.number}</span>
            `).join('');

            // Tally and Render Aggregated Existing Tags on Selected Items
            const tagTallies = {};
            selectedQuestions.forEach(q => {
                if (q.tags) {
                    q.tags.forEach(t => {
                        tagTallies[t] = (tagTallies[t] || 0) + 1;
                    });
                }
            });

            const uniqueTags = Object.keys(tagTallies);
            if (uniqueTags.length > 0) {
                bulkExistingTagsSection.style.display = 'block';
                bulkExistingTagsList.innerHTML = uniqueTags.map(tag => `
                    <span class="tag-bubble" style="background-color: rgba(99, 102, 241, 0.06); border-color: rgba(99, 102, 241, 0.18);">
                        #${tag} <span style="font-size: 10px; opacity: 0.6; margin-left: 2px;">(${tagTallies[tag]}/${count})</span>
                        <button class="btn-bulk-remove-tag-pill" data-tag="${tag}" title="Strip tag from all selected items" style="cursor: pointer;">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </span>
                `).join('');
                
                // Attach bulk-remove triggers
                document.querySelectorAll('.btn-bulk-remove-tag-pill').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const tagToRemove = btn.getAttribute('data-tag');
                        await bulkUpdateTags([tagToRemove], 'remove');
                    });
                });
            } else {
                bulkExistingTagsSection.style.display = 'none';
                bulkExistingTagsList.innerHTML = '';
            }
        }
    }

    function selectQuestion(qid) {
        const question = state.questions.find(q => q.id === qid);
        if (!question) return;

        state.currentQuestion = question;

        // Render Identity & Details
        taggerBadgeSection.textContent = question.section;
        taggerTitle.textContent = `Question ${question.number}`;
        taggerBadgeMarks.textContent = `${question.marks} ${question.marks === 1 ? 'mark' : 'marks'}`;
        taggerPagesIndicator.textContent = `Pages: ${question.pages.join(', ')}`;

        // Populate active tags
        renderActiveTags(question.tags);

        // Highlight active suggested tags
        updateSuggestedTagsHighlight(question.tags);

        // Render PDF page images in visual canvas
        taggerCanvas.innerHTML = question.pages.map(page => `
            <img src="/images/${state.currentExamId}/page_${page}.png" alt="Page ${page}" loading="lazy">
        `).join('');

        // Prepopulate layout adjuster fields
        adjSection.value = question.section;
        adjNumber.value = question.number;
        adjMarks.value = question.marks;
        adjPages.value = question.pages.join(', ');
        adjText.value = question.text;
        
        // Render Class seen checklists
        renderTaggerClassChecklist(qid);
        
        // Hide adjustment drawer by default
        adjustDrawer.style.display = 'none';

        // Update worksheet builder button data-qid
        if (btnTaggerWorksheetToggle) {
            btnTaggerWorksheetToggle.setAttribute('data-qid', qid);
        }
        syncWorksheetButtons();
    }

    function renderTaggerClassChecklist(qid) {
        if (!state.classes || state.classes.length === 0) {
            taggerClassChecklist.innerHTML = `<span class="empty-state" style="font-size:12px; padding:0; width: 100%;">No cohorts registered yet. Add classes in the Class Tracker tab.</span>`;
            return;
        }

        taggerClassChecklist.innerHTML = state.classes.map(cls => {
            const isSeen = cls.seen_questions && cls.seen_questions.includes(qid);
            return `
                <label class="class-seen-checkbox-label ${isSeen ? 'checked' : ''}" data-cid="${cls.id}">
                    <input type="checkbox" class="tagger-class-checkbox" data-cid="${cls.id}" ${isSeen ? 'checked' : ''}>
                    <span>${cls.name}</span>
                </label>
            `;
        }).join('');

        // Attach toggles to checkboxes
        document.querySelectorAll('.tagger-class-checkbox').forEach(cb => {
            cb.addEventListener('change', async () => {
                const cid = cb.getAttribute('data-cid');
                const label = cb.closest('.class-seen-checkbox-label');
                
                const result = await apiRequest(`/api/classes/${cid}/toggle-seen`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question_id: qid })
                });

                if (result && result.success) {
                    // Update local state memory
                    const cls = state.classes.find(c => c.id === cid);
                    if (cls) {
                        if (result.seen) {
                            if (!cls.seen_questions.includes(qid)) cls.seen_questions.push(qid);
                            label.classList.add('checked');
                        } else {
                            cls.seen_questions = cls.seen_questions.filter(id => id !== qid);
                            label.classList.remove('checked');
                        }
                    }
                    // Sync Class Tracker if it is active
                    if (state.activeTab === 'classes' && state.currentClassId === cid) {
                        loadClassQuestionsChecklist();
                    }
                }
            });
        });
    }

    function renderActiveTags(tags) {
        if (!tags || tags.length === 0) {
            taggerActiveTags.innerHTML = `<span class="empty-state">No tags added yet. Use suggestions or type a custom tag below.</span>`;
            return;
        }

        taggerActiveTags.innerHTML = tags.map(tag => `
            <span class="tag-bubble">
                #${tag}
                <button class="btn-remove-tag" data-tag="${tag}">
                    <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </span>
        `).join('');

        // Attach tag removal events
        document.querySelectorAll('.btn-remove-tag').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tagToRemove = btn.getAttribute('data-tag');
                removeTag(tagToRemove);
            });
        });
    }

    function updateSuggestedTagsHighlight(tags) {
        document.querySelectorAll('.btn-tag-suggest').forEach(btn => {
            const tagVal = btn.getAttribute('data-tag');
            if (tags.includes(tagVal)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Toggle suggested tags on click
    document.querySelectorAll('.btn-tag-suggest').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!state.currentQuestion) return;
            const tagVal = btn.getAttribute('data-tag');
            
            if (state.currentQuestion.tags.includes(tagVal)) {
                removeTag(tagVal);
            } else {
                addTag(tagVal);
            }
        });
    });

    // Custom Tag Submission
    async function handleAddCustomTag() {
        if (!state.currentQuestion) return;
        const rawTag = customTagInput.value.trim().toLowerCase();
        if (!rawTag) return;
        
        await addTag(rawTag);
        customTagInput.value = '';
    }

    customTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustomTag();
        }
    });

    btnAddCustomTag.addEventListener('click', handleAddCustomTag);

    async function addTag(tag) {
        if (!state.currentQuestion) return;
        
        // Clean tag
        const cleanTag = tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (!cleanTag || state.currentQuestion.tags.includes(cleanTag)) return;

        const newTags = [...state.currentQuestion.tags, cleanTag];
        
        const result = await apiRequest(`/api/questions/${state.currentExamId}/${state.currentQuestion.id}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: newTags })
        });

        if (result && result.success) {
            state.currentQuestion.tags = newTags;
            renderActiveTags(newTags);
            updateSuggestedTagsHighlight(newTags);
            const idx = state.questions.findIndex(q => q.id === state.currentQuestion.id);
            if (idx !== -1) {
                state.questions[idx].tags = newTags;
            }
            syncSidebarQuestionTags(state.currentQuestion.id, newTags);
        }
    }

    async function removeTag(tag) {
        if (!state.currentQuestion) return;

        const newTags = state.currentQuestion.tags.filter(t => t !== tag);
        
        const result = await apiRequest(`/api/questions/${state.currentExamId}/${state.currentQuestion.id}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: newTags })
        });

        if (result && result.success) {
            state.currentQuestion.tags = newTags;
            renderActiveTags(newTags);
            updateSuggestedTagsHighlight(newTags);
            const idx = state.questions.findIndex(q => q.id === state.currentQuestion.id);
            if (idx !== -1) {
                state.questions[idx].tags = newTags;
            }
            syncSidebarQuestionTags(state.currentQuestion.id, newTags);
        }
    }

    function syncSidebarQuestionTags(qid, tags) {
        const tagsRow = document.querySelector(`.q-nav-item-row[data-qid="${qid}"] .q-nav-tags-row`);
        if (tagsRow) {
            tagsRow.innerHTML = tags.length > 0 
                ? tags.map(t => `<span class="q-nav-tag" data-tag="${t}" data-qid="${qid}">#${t}<span class="q-nav-tag-remove" data-tag="${t}" data-qid="${qid}">&times;</span></span>`).join('') 
                : '<span class="q-nav-tag untagged">#untagged</span>';
                
            tagsRow.querySelectorAll('.q-nav-tag-remove').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const innerQId = btn.getAttribute('data-qid');
                    const innerTag = btn.getAttribute('data-tag');
                    await removeTagFromQuestionDirect(innerQId, innerTag);
                });
            });
        }
    }

    async function removeTagFromQuestionDirect(qid, tag) {
        const q = state.questions.find(item => item.id === qid);
        if (!q) return;
        
        const newTags = q.tags.filter(t => t !== tag);
        
        const result = await apiRequest(`/api/questions/${state.currentExamId}/${qid}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: newTags })
        });
        
        if (result && result.success) {
            q.tags = newTags;
            if (state.currentQuestion && state.currentQuestion.id === qid) {
                state.currentQuestion.tags = newTags;
                renderActiveTags(newTags);
                updateSuggestedTagsHighlight(newTags);
            }
            syncSidebarQuestionTags(qid, newTags);
        }
    }

    async function bulkUpdateTags(tagList, action) {
        if (state.selectedQuestionIds.length === 0) return;
        
        // Clean tag items
        const cleanTags = tagList.map(tag => tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')).filter(t => t);
        if (cleanTags.length === 0) return;

        const result = await apiRequest(`/api/exams/${state.currentExamId}/tags/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_ids: state.selectedQuestionIds,
                tags: cleanTags,
                action: action
            })
        });

        if (result && result.success) {
            // Update local state tags immediately
            state.questions.forEach(q => {
                if (state.selectedQuestionIds.includes(q.id)) {
                    let current = q.tags || [];
                    if (action === 'add') {
                        cleanTags.forEach(t => {
                            if (!current.includes(t)) current.push(t);
                        });
                    } else if (action === 'remove') {
                        current = current.filter(t => !cleanTags.includes(t));
                    }
                    q.tags = current;
                    syncSidebarQuestionTags(q.id, current);
                }
            });
            
            // Clear inputs
            bulkTagInput.value = '';
            bulkRemoveTagInput.value = '';
            
            // Re-render bulk selection view to reflect tag tallies in real-time
            updateBulkSelectionState();
            
            // Update cloud and search index
            rebuildTagCloud();
        }
    }

    // Attach listeners for bulk buttons
    btnBulkAddTag.addEventListener('click', () => {
        const rawTag = bulkTagInput.value.trim().toLowerCase();
        if (rawTag) bulkUpdateTags([rawTag], 'add');
    });

    bulkTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const rawTag = bulkTagInput.value.trim().toLowerCase();
            if (rawTag) bulkUpdateTags([rawTag], 'add');
        }
    });

    btnBulkRemoveTag.addEventListener('click', () => {
        const rawTag = bulkRemoveTagInput.value.trim().toLowerCase();
        if (rawTag) bulkUpdateTags([rawTag], 'remove');
    });

    bulkRemoveTagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const rawTag = bulkRemoveTagInput.value.trim().toLowerCase();
            if (rawTag) bulkUpdateTags([rawTag], 'remove');
        }
    });

    // Bulk suggested list toggles
    document.querySelectorAll('.btn-tag-suggest-bulk').forEach(btn => {
        btn.addEventListener('click', () => {
            const tagVal = btn.getAttribute('data-tag');
            bulkUpdateTags([tagVal], 'add');
        });
    });

    btnClearBulk.addEventListener('click', () => {
        state.selectedQuestionIds = [];
        updateBulkSelectionState();
    });

    btnSelectAll.addEventListener('click', () => {
        state.selectedQuestionIds = state.questions.map(q => q.id);
        updateBulkSelectionState();
    });

    btnSelectNone.addEventListener('click', () => {
        state.selectedQuestionIds = [];
        updateBulkSelectionState();
    });

    // Toggle adjustment layout drawer
    btnToggleAdjust.addEventListener('click', () => {
        if (adjustDrawer.style.display === 'none') {
            adjustDrawer.style.display = 'block';
        } else {
            adjustDrawer.style.display = 'none';
        }
    });

    btnCancelAdjust.addEventListener('click', () => {
        adjustDrawer.style.display = 'none';
    });

    // Save adjustment form submission
    adjustForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!state.currentQuestion) return;

        // Parse pages
        const pagesStr = adjPages.value.split(',');
        const pagesList = pagesStr.map(p => parseInt(p.trim())).filter(p => !isNaN(p));

        const adjustData = {
            section: adjSection.value,
            number: parseInt(adjNumber.value),
            marks: parseInt(adjMarks.value),
            pages: pagesList,
            text: adjText.value
        };

        const result = await apiRequest(`/api/questions/${state.currentExamId}/${state.currentQuestion.id}/adjust`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adjustData)
        });

        if (result && result.success) {
            alert('Adjustments saved successfully!');
            adjustDrawer.style.display = 'none';
            // Reload exam questions to reflect sidebar and canvas updates
            await loadQuestionsForExam(state.currentExamId);
            selectQuestion(state.currentQuestion.id);
        }
    });


    // --- TAB 3: TAG LIBRARY SEARCH ---
    let searchDebounceTimer;
    librarySearchInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            state.searchQuery = librarySearchInput.value;
            performSearch();
        }, 300);
    });

    if (libraryClassSelect) {
        libraryClassSelect.addEventListener('change', () => {
            performSearch();
        });
    }

    if (librarySeenSelect) {
        librarySeenSelect.addEventListener('change', () => {
            performSearch();
        });
    }

    async function refreshSearchLibrary() {
        // Clear old states
        state.searchTag = '';
        state.searchQuery = '';
        librarySearchInput.value = '';
        populateSearchClassSelect();
        if (libraryClassSelect) libraryClassSelect.value = '';
        if (librarySeenSelect) librarySeenSelect.value = 'all';
        
        await performSearch();
    }

    async function performSearch() {
        let url = `/api/search?q=${encodeURIComponent(state.searchQuery)}`;
        if (state.searchTag) {
            url += `&tag=${encodeURIComponent(state.searchTag)}`;
        }

        const results = await apiRequest(url);
        if (!results) return;

        // Apply Client-Side Filter by Class and Seen/Unseen Status
        const classFilterVal = libraryClassSelect ? libraryClassSelect.value : '';
        const seenFilterVal = librarySeenSelect ? librarySeenSelect.value : 'all';

        let filteredResults = results;

        if (classFilterVal) {
            const targetClass = state.classes.find(cls => cls.id === classFilterVal);
            const seenQIds = new Set(targetClass ? (targetClass.seen_questions || []) : []);
            if (seenFilterVal === 'seen') {
                filteredResults = results.filter(res => seenQIds.has(res.question.id));
            } else if (seenFilterVal === 'unseen') {
                filteredResults = results.filter(res => !seenQIds.has(res.question.id));
            }
        } else {
            if (seenFilterVal === 'seen') {
                filteredResults = results.filter(res => 
                    state.classes.some(cls => cls.seen_questions && cls.seen_questions.includes(res.question.id))
                );
            } else if (seenFilterVal === 'unseen') {
                filteredResults = results.filter(res => 
                    !state.classes.some(cls => cls.seen_questions && cls.seen_questions.includes(res.question.id))
                );
            }
        }

        // Render matching question cards
        if (filteredResults.length === 0) {
            searchResultsGrid.innerHTML = `
                <div class="empty-state-large card glass" style="grid-column: 1 / -1;">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8M21 21l-4.35-4.35"/>
                    </svg>
                    <h2>No Matching Questions</h2>
                    <p>Try refining your search terms, filtering by other study tags, or adjusting your cohort seen/unseen filters.</p>
                </div>
            `;
        } else {
            searchResultsGrid.innerHTML = filteredResults.map(res => {
                const q = res.question;
                const textSnippetHtml = q.text ? highlightKeyword(q.text.replace(/\[Page \d+\]/g, '').substring(0, 140) + '...', state.searchQuery) : 'No text content extracted.';
                const tagsHtml = q.tags && q.tags.length > 0 
                    ? q.tags.map(t => `<span class="q-result-tag">#${t}</span>`).join('') 
                    : '<span class="q-result-tag" style="opacity:0.4;">#untagged</span>';

                const seenClasses = state.classes.filter(cls => cls.seen_questions && cls.seen_questions.includes(q.id));
                const seenHtml = seenClasses.length > 0
                    ? seenClasses.map(cls => `<span class="q-result-seen-badge" title="Seen by ${cls.name}">${cls.name.substring(0, 5)}</span>`).join('')
                    : '';

                return `
                    <div class="q-result-card glass" data-examid="${res.exam_id}" data-qid="${q.id}">
                        <div class="q-result-header">
                            <div>
                                <div class="q-result-exam">${res.exam_title}</div>
                                <h3 class="q-result-title">${q.section} Question ${q.number}</h3>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                                <button class="btn-worksheet-toggle" data-qid="${q.id}" data-examid="${res.exam_id}" data-examtitle="${res.exam_title}" data-section="${q.section}" data-number="${q.number}" data-marks="${q.marks}">
                                    + Worksheet
                                </button>
                                <span class="badge-marks">${q.marks} mk</span>
                            </div>
                        </div>
                        <div class="q-result-body">
                            ${textSnippetHtml}
                        </div>
                        <div class="q-result-tags" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                ${tagsHtml}
                            </div>
                            <div style="display: flex; gap: 4px; flex-shrink: 0;">
                                ${seenHtml}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Attach click listeners to question cards to open overlay modal
            document.querySelectorAll('.q-result-card').forEach(card => {
                card.addEventListener('click', () => {
                    const examId = card.getAttribute('data-examid');
                    const qid = card.getAttribute('data-qid');
                    openQuestionModal(examId, qid);
                });
            });

            // Attach click listeners to search card worksheet toggle buttons
            document.querySelectorAll('.q-result-card .btn-worksheet-toggle').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Stop opening the details modal
                    const qid = btn.getAttribute('data-qid');
                    const examId = btn.getAttribute('data-examid');
                    const examTitle = btn.getAttribute('data-examtitle');
                    const section = btn.getAttribute('data-section');
                    const number = parseInt(btn.getAttribute('data-number'));
                    const marks = parseInt(btn.getAttribute('data-marks'));
                    
                    const qRef = { id: qid, section: section, number: number, marks: marks };
                    toggleWorksheetQuestion(examId, examTitle, qRef);
                });
            });

            // Sync visual states for newly rendered buttons
            syncWorksheetButtons();
        }

        // Re-generate Tag Cloud counts based on active library databases
        rebuildTagCloud();
    }

    async function rebuildTagCloud() {
        const allQuestionsSearch = await apiRequest('/api/search'); // fetch everything to tally tags
        if (!allQuestionsSearch) return;

        const tagCounts = {};
        allQuestionsSearch.forEach(res => {
            const q = res.question;
            if (q.tags) {
                q.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        state.allTags = tagCounts;

        if (Object.keys(tagCounts).length === 0) {
            libraryTagCloud.innerHTML = `<span class="empty-state" style="font-size:12px; padding:0;">No study tags have been created yet.</span>`;
            return;
        }

        libraryTagCloud.innerHTML = Object.entries(tagCounts).map(([tag, count]) => `
            <div class="tag-cloud-item ${state.searchTag === tag ? 'active' : ''}" data-tag="${tag}">
                #${tag}
                <span class="tag-count">${count}</span>
            </div>
        `).join('');

        // Attach click listeners to tag cloud items
        document.querySelectorAll('.tag-cloud-item').forEach(item => {
            item.addEventListener('click', () => {
                const clickedTag = item.getAttribute('data-tag');
                if (state.searchTag === clickedTag) {
                    // Untoggle
                    state.searchTag = '';
                } else {
                    state.searchTag = clickedTag;
                }
                
                performSearch();
            });
        });
    }


    // --- MODAL DIALOG PREVIEWS ---
    async function openQuestionModal(examId, qid) {
        const examDetails = await apiRequest(`/api/exams/${examId}/questions`);
        if (!examDetails) return;

        const q = examDetails.questions.find(item => item.id === qid);
        if (!q) return;

        modalExamTitle.textContent = examDetails.title;
        modalBadgeSection.textContent = q.section;
        modalQTitle.textContent = `Question ${q.number}`;
        modalBadgeMarks.textContent = `${q.marks} ${q.marks === 1 ? 'mark' : 'marks'}`;
        
        // Clean and render text content with search matches highlighted
        modalTextContent.innerHTML = q.text ? highlightKeyword(q.text, state.searchQuery) : 'No description or text extracted.';

        // Render modal tags function (makes tag pills interactive inside details view!)
        function renderModalTagsList(tags) {
            if (tags && tags.length > 0) {
                modalTagsList.innerHTML = tags.map(t => `
                    <span class="tag-bubble" style="animation: scaleUp 0.15s ease;">
                        #${t}
                        <button class="btn-modal-remove-tag" data-tag="${t}" title="Remove tag">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </span>
                `).join('');
                
                // Attach delete event listeners inside the modal tag pills
                modalTagsList.querySelectorAll('.btn-modal-remove-tag').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const tagToRemove = btn.getAttribute('data-tag');
                        const newTags = q.tags.filter(t => t !== tagToRemove);
                        
                        const result = await apiRequest(`/api/questions/${examId}/${qid}/tags`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tags: newTags })
                        });
                        
                        if (result && result.success) {
                            q.tags = newTags;
                            
                            // Synchronize Question Tagger views & state memory
                            if (state.currentQuestion && state.currentQuestion.id === qid) {
                                state.currentQuestion.tags = newTags;
                                renderActiveTags(newTags);
                                updateSuggestedTagsHighlight(newTags);
                            }
                            const idx = state.questions.findIndex(item => item.id === qid);
                            if (idx !== -1) {
                                state.questions[idx].tags = newTags;
                            }
                            syncSidebarQuestionTags(qid, newTags);
                            
                            // Sync Search Library view (re-render cards below)
                            performSearch();
                            
                            // Refresh modal tags view
                            renderModalTagsList(newTags);
                        }
                    });
                });
            } else {
                modalTagsList.innerHTML = `<span class="empty-state" style="font-size:12px; padding:0;">Untagged question</span>`;
            }
        }

        // Render tags initially
        renderModalTagsList(q.tags);

        // Bind interactive tag inputs inside details modal
        const modalTagInput = document.getElementById('modal-tag-input');
        const btnModalAddTag = document.getElementById('btn-modal-add-tag');
        
        async function handleModalAddTag() {
            const activeInput = document.getElementById('modal-tag-input');
            if (!activeInput) return;
            const val = activeInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
            if (!val) return;
            
            const currentTags = q.tags || [];
            if (currentTags.includes(val)) {
                activeInput.value = '';
                return;
            }
            
            const newTags = [...currentTags, val];
            
            const result = await apiRequest(`/api/questions/${examId}/${qid}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: newTags })
            });
            
            if (result && result.success) {
                q.tags = newTags;
                activeInput.value = '';
                
                // Synchronize Question Tagger views & state memory
                if (state.currentQuestion && state.currentQuestion.id === qid) {
                    state.currentQuestion.tags = newTags;
                    renderActiveTags(newTags);
                    updateSuggestedTagsHighlight(newTags);
                }
                const idx = state.questions.findIndex(item => item.id === qid);
                if (idx !== -1) {
                    state.questions[idx].tags = newTags;
                }
                syncSidebarQuestionTags(qid, newTags);
                
                // Sync Search Library view (re-render cards below)
                performSearch();
                
                // Refresh modal tags view
                renderModalTagsList(newTags);
            }
        }
        
        // Safely clone inputs to avoid duplicate listener bindings from modal reuse
        const newBtnModalAddTag = btnModalAddTag.cloneNode(true);
        btnModalAddTag.parentNode.replaceChild(newBtnModalAddTag, btnModalAddTag);
        
        const newModalTagInput = modalTagInput.cloneNode(true);
        modalTagInput.parentNode.replaceChild(newModalTagInput, modalTagInput);
        
        newBtnModalAddTag.addEventListener('click', handleModalAddTag);
        newModalTagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleModalAddTag();
            }
        });

        // Render modal classes seen checklist (interactive seen status switcher)
        if (state.classes && state.classes.length > 0) {
            modalClassesSeenList.innerHTML = state.classes.map(cls => {
                const isSeen = cls.seen_questions && cls.seen_questions.includes(qid);
                return `
                    <label class="class-seen-checkbox-label ${isSeen ? 'checked' : ''}" data-cid="${cls.id}">
                        <input type="checkbox" class="modal-class-checkbox" data-cid="${cls.id}" ${isSeen ? 'checked' : ''}>
                        <span>${cls.name}</span>
                    </label>
                `;
            }).join('');

            // Attach toggles to checkboxes
            document.querySelectorAll('.modal-class-checkbox').forEach(cb => {
                cb.addEventListener('change', async () => {
                    const cid = cb.getAttribute('data-cid');
                    const label = cb.closest('.class-seen-checkbox-label');
                    
                    const result = await apiRequest(`/api/classes/${cid}/toggle-seen`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ question_id: qid })
                    });

                    if (result && result.success) {
                        // Update local state memory
                        const cls = state.classes.find(c => c.id === cid);
                        if (cls) {
                            if (result.seen) {
                                if (!cls.seen_questions.includes(qid)) cls.seen_questions.push(qid);
                                label.classList.add('checked');
                            } else {
                                cls.seen_questions = cls.seen_questions.filter(id => id !== qid);
                                label.classList.remove('checked');
                            }
                        }
                        
                        // Sync Search Library Results Grid (update seen indicator pills on cards below)
                        performSearch();
                    }
                });
            });
        } else {
            modalClassesSeenList.innerHTML = `<span class="empty-state" style="font-size:12px; padding:0; width: 100%;">No cohorts registered yet. Add classes in the Class Tracker tab.</span>`;
        }

        // Render PNG images
        modalCanvas.innerHTML = q.pages.map(page => `
            <img src="/images/${examId}/page_${page}.png" alt="Page ${page}">
        `).join('');

        // Update worksheet builder button in modal
        if (btnModalWorksheetToggle) {
            btnModalWorksheetToggle.setAttribute('data-qid', qid);
            btnModalWorksheetToggle.setAttribute('data-examid', examId);
        }
        syncWorksheetButtons();

        questionModal.style.display = 'flex';
    }

    function closeModal() {
        questionModal.style.display = 'none';
    }

    btnCloseModal.addEventListener('click', closeModal);
    questionModal.addEventListener('click', (e) => {
        if (e.target === questionModal) {
            closeModal();
        }
    });

    // ==========================================
    // --- TAB 4: CLASS SEEN TRACKER CONTROLLER ---
    // ==========================================

    async function fetchClasses() {
        const classes = await apiRequest('/api/classes');
        if (classes) {
            state.classes = classes;
            populateSearchClassSelect();
        }
    }

    function populateSearchClassSelect() {
        if (!libraryClassSelect) return;
        const currentValue = libraryClassSelect.value;
        let html = '<option value="">-- All Classes --</option>';
        if (state.classes && state.classes.length > 0) {
            html += state.classes.map(cls => `
                <option value="${cls.id}">${cls.name}</option>
            `).join('');
        }
        libraryClassSelect.innerHTML = html;
        if (state.classes.some(cls => cls.id === currentValue)) {
            libraryClassSelect.value = currentValue;
        } else {
            libraryClassSelect.value = '';
        }
    }

    async function loadClassesTracker() {
        await fetchClasses();
        const exams = await apiRequest('/api/exams');
        if (!exams) return;
        state.exams = exams;

        // Render exam dropdown inside classes log
        if (exams.length > 0) {
            classExamSelect.innerHTML = exams.map(exam => `
                <option value="${exam.id}" ${exam.id === state.currentExamId ? 'selected' : ''}>${exam.title}</option>
            `).join('');
            
            if (!state.currentExamId) {
                state.currentExamId = exams[0].id;
            }
            classExamSelect.value = state.currentExamId;
        } else {
            classExamSelect.innerHTML = `<option value="">-- No Exams Available --</option>`;
        }

        // Render classes sidebar list
        renderClassesSidebar();

        // Manage active panels
        if (state.classes.length === 0) {
            classesEmptyState.style.display = 'flex';
            classesActivePanel.style.display = 'none';
            state.currentClassId = '';
        } else {
            if (!state.currentClassId) {
                state.currentClassId = state.classes[0].id;
            }
            selectClass(state.currentClassId);
        }
    }

    function renderClassesSidebar() {
        if (state.classes.length === 0) {
            classesListContainer.innerHTML = `
                <div class="empty-state">
                    <p style="font-size:12px;">No cohorts registered yet. Enter a cohort name above to get started.</p>
                </div>
            `;
            return;
        }

        classesListContainer.innerHTML = state.classes.map(cls => `
            <button class="q-nav-item ${state.currentClassId === cls.id ? 'active' : ''}" data-cid="${cls.id}" style="justify-content: space-between;">
                <div class="q-nav-name" style="display:flex; align-items:center; gap:8px;">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-purple);">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>
                    </svg>
                    ${cls.name}
                </div>
                <div class="q-nav-badge" style="background-color: var(--accent-mint-glow); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.2);">
                    ${cls.seen_questions ? cls.seen_questions.length : 0} seen
                </div>
            </button>
        `).join('');

        // Attach select listeners to class items
        document.querySelectorAll('#classes-list-container .q-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const cid = btn.getAttribute('data-cid');
                selectClass(cid);
            });
        });
    }

    async function selectClass(classId) {
        state.currentClassId = classId;
        const cls = state.classes.find(c => c.id === classId);
        if (!cls) return;

        // Toggle list active classes
        document.querySelectorAll('#classes-list-container .q-nav-item').forEach(btn => {
            if (btn.getAttribute('data-cid') === classId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        classesEmptyState.style.display = 'none';
        classesActivePanel.style.display = 'grid';

        // Render Title & Header
        classTrackerTitle.textContent = cls.name;

        // Load checklists
        await loadClassQuestionsChecklist();
    }

    async function loadClassQuestionsChecklist() {
        if (!state.currentClassId || !state.currentExamId) return;
        
        const examDetails = await apiRequest(`/api/exams/${state.currentExamId}/questions`);
        if (!examDetails) return;
        
        const cls = state.classes.find(c => c.id === state.currentClassId);
        if (!cls) return;

        const seenList = cls.seen_questions || [];
        const questions = examDetails.questions;

        if (questions.length === 0) {
            classQuestionsChecklistGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <p>No questions found in this exam paper to track.</p>
                </div>
            `;
            classSeenStats.textContent = `0 of 0 Completed`;
            return;
        }

        classQuestionsChecklistGrid.innerHTML = questions.map(q => {
            const isSeen = seenList.includes(q.id);
            return `
                <div class="class-seen-card ${isSeen ? 'seen' : ''}" data-qid="${q.id}">
                    <div class="class-seen-info">
                        <span class="class-seen-q-title">${q.section} Question ${q.number}</span>
                        <span class="class-seen-q-meta">${q.marks} marks • Pages: ${q.pages.join(', ')}</span>
                    </div>
                    <span class="class-seen-status-badge">${isSeen ? 'Seen' : 'Unseen'}</span>
                </div>
            `;
        }).join('');

        // Update stats counter
        const examQIds = questions.map(q => q.id);
        const examSeenCount = seenList.filter(id => examQIds.includes(id)).length;
        classSeenStats.textContent = `${examSeenCount} of ${questions.length} Completed`;

        // Render syllabus analytics gauges
        renderSyllabusCoverage(cls, questions);


        // Attach seen card click switch listeners
        document.querySelectorAll('.class-seen-card').forEach(card => {
            card.addEventListener('click', async () => {
                const qid = card.getAttribute('data-qid');
                await toggleClassSeenState(state.currentClassId, qid, card);
            });
        });
    }

    async function toggleClassSeenState(classId, qid, card) {
        const result = await apiRequest(`/api/classes/${classId}/toggle-seen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: qid })
        });

        if (result && result.success) {
            // Update local memory
            const cls = state.classes.find(c => c.id === classId);
            if (cls) {
                if (result.seen) {
                    if (!cls.seen_questions.includes(qid)) {
                        cls.seen_questions.push(qid);
                    }
                } else {
                    cls.seen_questions = cls.seen_questions.filter(id => id !== qid);
                }
            }

            // Sync visual states on this card
            if (card) {
                if (result.seen) {
                    card.classList.add('seen');
                    card.querySelector('.class-seen-status-badge').textContent = 'Seen';
                } else {
                    card.classList.remove('seen');
                    card.querySelector('.class-seen-status-badge').textContent = 'Unseen';
                }
            }

            // Update cohort sidebar list badges & header stats
            renderClassesSidebar();
            
            // Re-tally checklist stats
            if (state.currentExamId) {
                const examDetails = state.questions.length > 0 ? state.questions : (await apiRequest(`/api/exams/${state.currentExamId}/questions`))?.questions || [];
                const examQIds = examDetails.map(q => q.id);
                const count = cls.seen_questions.filter(id => examQIds.includes(id)).length;
                classSeenStats.textContent = `${count} of ${examQIds.length} Completed`;
                renderSyllabusCoverage(cls, examDetails);
            }
        }
    }

    // Connect class creation trigger
    async function handleAddClass() {
        const name = classNameInput.value.trim();
        if (!name) return;

        const result = await apiRequest('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });

        if (result && result.success) {
            classNameInput.value = '';
            state.classes.push(result.class);
            renderClassesSidebar();
            selectClass(result.class.id);
        }
    }

    btnAddClass.addEventListener('click', handleAddClass);
    classNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddClass();
        }
    });

    // Delete cohort
    btnDeleteClass.addEventListener('click', async () => {
        if (!state.currentClassId) return;
        const cls = state.classes.find(c => c.id === state.currentClassId);
        if (!cls) return;

        if (!confirm(`Are you sure you want to delete class cohort '${cls.name}'? This seen log will be lost.`)) {
            return;
        }

        const result = await apiRequest(`/api/classes/${state.currentClassId}`, {
            method: 'DELETE'
        });

        if (result && result.success) {
            state.classes = state.classes.filter(c => c.id !== state.currentClassId);
            state.currentClassId = '';
            loadClassesTracker();
        }
    });

    // Class Tracker exam filter selector trigger
    classExamSelect.addEventListener('change', async (e) => {
        state.currentExamId = e.target.value;
        await loadClassQuestionsChecklist();
    });


    // ==========================================
    // --- SUITE 10 & 11: WORKSHEET BUILDER & SYLLABUS ANALYTICS ENGINE ---
    // ==========================================

    function detectQuestionDomain(q) {
        const text = (q.text || '').toLowerCase();
        const tags = (q.tags || []).map(t => t.toLowerCase());
        
        // Check tags first
        if (tags.includes('calculus') || tags.includes('differential-equations') || tags.includes('integration') || tags.includes('differentiation') || tags.includes('solids-of-revolution') || tags.includes('rates-of-change')) return 'Calculus';
        if (tags.includes('vectors') || tags.includes('matrices') || tags.includes('planes') || tags.includes('matrix')) return 'Vectors & Matrices';
        if (tags.includes('complex-numbers') || tags.includes('argand-plane') || tags.includes('algebra')) return 'Complex Numbers';
        if (tags.includes('probability') || tags.includes('statistics') || tags.includes('normal-distribution') || tags.includes('confidence-intervals') || tags.includes('hypothesis-testing')) return 'Probability & Stats';
        if (tags.includes('mechanics') || tags.includes('kinematics') || tags.includes('dynamics') || tags.includes('forces')) return 'Mechanics & Kinematics';
        if (tags.includes('graphs') || tags.includes('functions') || tags.includes('asymptotes')) return 'Functions & Graphs';
        
        // Check text heuristics
        if (text.includes('volume of revolution') || text.includes('differential equation') || text.includes('integral') || text.includes('derivative') || text.includes('calculus') || text.includes(' dy ') || text.includes(' dx ') || text.includes('dt') || text.includes('substitution u')) return 'Calculus';
        if (text.includes('vector') || text.includes('plane') || text.includes('matrix') || text.includes('matrices') || text.includes('i') || text.includes('j') || text.includes('k') || text.includes('r') || text.includes('v') || text.includes('a') || text.includes('vector algebra')) return 'Vectors & Matrices';
        if (text.includes('complex') || text.includes('argand') || text.includes(' z =') || text.includes('imaginary') || text.includes('re(') || text.includes('im(') || text.includes('∈ c')) return 'Complex Numbers';
        if (text.includes('probability') || text.includes('mean') || text.includes('standard deviation') || text.includes('confidence interval') || text.includes('hypothesis') || text.includes('p value') || text.includes('normally distributed') || text.includes('level of significance') || text.includes('statistical test')) return 'Probability & Stats';
        if (text.includes('mechanics') || text.includes('kinematics') || text.includes('velocity') || text.includes('acceleration') || text.includes('force') || text.includes('gravity') || text.includes('mass') || text.includes('particle') || text.includes('projection') || text.includes('speed') || text.includes('projected')) return 'Mechanics & Kinematics';
        if (text.includes('asymptote') || text.includes('inflection') || text.includes('graph') || text.includes('domain') || text.includes('intercept') || text.includes('curve') || text.includes('sketch') || text.includes('stationary point')) return 'Functions & Graphs';
        
        return 'Other';
    }

    function renderSyllabusCoverage(cls, questions) {
        const grid = document.getElementById('class-syllabus-grid');
        if (!grid) return;

        const syllabusCategories = [
            { name: "Calculus", color: "linear-gradient(90deg, #6366f1, #3b82f6)" },
            { name: "Vectors & Matrices", color: "linear-gradient(90deg, #3b82f6, #06b6d4)" },
            { name: "Complex Numbers", color: "linear-gradient(90deg, #06b6d4, #10b981)" },
            { name: "Probability & Stats", color: "linear-gradient(90deg, #10b981, #34d399)" },
            { name: "Mechanics & Kinematics", color: "linear-gradient(90deg, #e11d48, #f43f5e)" },
            { name: "Functions & Graphs", color: "linear-gradient(90deg, #f59e0b, #eab308)" }
        ];

        // Gather count for each domain
        const domainCounts = {};
        const domainSeen = {};
        
        syllabusCategories.forEach(cat => {
            domainCounts[cat.name] = 0;
            domainSeen[cat.name] = 0;
        });

        const seenList = cls.seen_questions || [];

        questions.forEach(q => {
            const domain = detectQuestionDomain(q);
            if (domainCounts[domain] !== undefined) {
                domainCounts[domain]++;
                if (seenList.includes(q.id)) {
                    domainSeen[domain]++;
                }
            }
        });

        grid.innerHTML = syllabusCategories.map(cat => {
            const total = domainCounts[cat.name];
            const completed = domainSeen[cat.name];
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            return `
                <div class="syllabus-domain-item">
                    <div class="syllabus-domain-header">
                        <span class="syllabus-domain-name">${cat.name}</span>
                        <span class="syllabus-domain-percentage" style="color: ${pct === 100 ? '#34d399' : 'var(--text-secondary)'};">${pct}%</span>
                    </div>
                    <div class="syllabus-progress-bar-wrapper">
                        <div class="syllabus-progress-bar-fill" style="width: ${pct}%; background: ${cat.color};"></div>
                    </div>
                    <div class="syllabus-domain-stats">${completed} of ${total} Completed</div>
                </div>
            `;
        }).join('');
    }

    function toggleWorksheetQuestion(examId, examTitle, q) {
        const index = state.worksheetQueue.findIndex(item => item.id === q.id);
        if (index > -1) {
            state.worksheetQueue.splice(index, 1);
        } else {
            state.worksheetQueue.push({
                exam_id: examId,
                exam_title: examTitle,
                id: q.id,
                section: q.section,
                number: q.number,
                marks: q.marks
            });
        }
        updateWorksheetBasketUI();
        syncWorksheetButtons();
    }

    function syncWorksheetButtons() {
        document.querySelectorAll('.btn-worksheet-toggle').forEach(btn => {
            const qid = btn.getAttribute('data-qid');
            if (!qid) return;
            const isAdded = state.worksheetQueue.some(item => item.id === qid);
            if (isAdded) {
                btn.classList.add('added');
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="3" fill="none">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Added</span>
                `;
            } else {
                btn.classList.remove('added');
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="3" fill="none">
                        <line x1="12" y1="5" x2="12" y2="19M5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>+ Worksheet</span>
                `;
            }
        });
    }

    function updateWorksheetBasketUI() {
        if (worksheetBasketBadge) {
            worksheetBasketBadge.textContent = state.worksheetQueue.length;
            if (state.worksheetQueue.length > 0) {
                worksheetBasketBadge.style.display = 'flex';
            } else {
                worksheetBasketBadge.style.display = 'none';
            }
        }
        
        if (!builderQueueList) return;
        
        if (state.worksheetQueue.length === 0) {
            builderQueueList.innerHTML = `
                <div class="empty-state" style="padding: 24px 0; font-size:11px; text-align:center; width:100%; color: var(--text-muted);">
                    Your worksheet queue is empty. Click "+ Worksheet" on any question to get started.
                </div>
            `;
            return;
        }
        
        builderQueueList.innerHTML = state.worksheetQueue.map((item, idx) => `
            <div class="builder-queue-item" data-qid="${item.id}">
                <div class="queue-item-info">
                    <span class="queue-item-title">${item.section} Question ${item.number}</span>
                    <span class="queue-item-sub">${item.exam_title} (${item.marks} mk)</span>
                </div>
                <div class="queue-item-controls">
                    <button class="btn-queue-order btn-order-up" data-idx="${idx}" title="Move Up" ${idx === 0 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none">
                            <polyline points="18 15 12 9 6 15"/>
                        </svg>
                    </button>
                    <button class="btn-queue-order btn-order-down" data-idx="${idx}" title="Move Down" ${idx === state.worksheetQueue.length - 1 ? 'disabled' : ''}>
                        <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </button>
                    <button class="btn-queue-delete" data-qid="${item.id}" title="Remove">
                        <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Reorder button click event listeners
        document.querySelectorAll('.btn-order-up').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-idx'));
                if (idx > 0) {
                    const temp = state.worksheetQueue[idx];
                    state.worksheetQueue[idx] = state.worksheetQueue[idx - 1];
                    state.worksheetQueue[idx - 1] = temp;
                    updateWorksheetBasketUI();
                    syncWorksheetButtons();
                }
            });
        });
        
        document.querySelectorAll('.btn-order-down').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-idx'));
                if (idx < state.worksheetQueue.length - 1) {
                    const temp = state.worksheetQueue[idx];
                    state.worksheetQueue[idx] = state.worksheetQueue[idx + 1];
                    state.worksheetQueue[idx + 1] = temp;
                    updateWorksheetBasketUI();
                    syncWorksheetButtons();
                }
            });
        });
        
        // Delete button click event listeners
        document.querySelectorAll('.btn-queue-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const qid = btn.getAttribute('data-qid');
                state.worksheetQueue = state.worksheetQueue.filter(item => item.id !== qid);
                updateWorksheetBasketUI();
                syncWorksheetButtons();
            });
        });
    }

    // Toggle builder drawer view
    if (worksheetBasketLauncher) {
        worksheetBasketLauncher.addEventListener('click', () => {
            builderDrawerOverlay.style.display = 'flex';
            updateWorksheetBasketUI();
        });
    }

    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', () => {
            builderDrawerOverlay.style.display = 'none';
        });
    }

    if (builderDrawerOverlay) {
        builderDrawerOverlay.addEventListener('click', (e) => {
            if (e.target === builderDrawerOverlay) {
                builderDrawerOverlay.style.display = 'none';
            }
        });
    }

    // Clear worksheet queue
    if (btnClearBasket) {
        btnClearBasket.addEventListener('click', () => {
            state.worksheetQueue = [];
            updateWorksheetBasketUI();
            syncWorksheetButtons();
        });
    }

    // Tagger details header worksheet button listener
    if (btnTaggerWorksheetToggle) {
        btnTaggerWorksheetToggle.addEventListener('click', () => {
            const qid = btnTaggerWorksheetToggle.getAttribute('data-qid');
            if (!qid) return;
            const q = state.questions.find(item => item.id === qid);
            if (!q) return;
            const exam = state.exams.find(e => e.id === state.currentExamId);
            const examTitle = exam ? exam.title : 'VCE Exam';
            toggleWorksheetQuestion(state.currentExamId, examTitle, q);
        });
    }

    // Details modal worksheet button listener
    if (btnModalWorksheetToggle) {
        btnModalWorksheetToggle.addEventListener('click', async () => {
            const qid = btnModalWorksheetToggle.getAttribute('data-qid');
            const examId = btnModalWorksheetToggle.getAttribute('data-examid');
            if (!qid || !examId) return;
            
            const examDetails = await apiRequest(`/api/exams/${examId}/questions`);
            if (!examDetails) return;
            const q = examDetails.questions.find(item => item.id === qid);
            if (!q) return;
            
            toggleWorksheetQuestion(examId, examDetails.title, q);
        });
    }

    // Compile & Download custom PDF worksheet trigger
    if (btnCompileWorksheet) {
        btnCompileWorksheet.addEventListener('click', async () => {
            if (state.worksheetQueue.length === 0) {
                alert("Please add at least one question to the worksheet queue first.");
                return;
            }
            
            compileLoader.style.display = 'flex';
            btnCompileWorksheet.disabled = true;
            
            const title = worksheetTitleInput.value.trim();
            const subtitle = worksheetSubtitleInput.value.trim();
            const questionRefs = state.worksheetQueue.map(item => ({
                exam_id: item.exam_id,
                q_id: item.id
            }));
            
            const result = await apiRequest('/api/builder/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    subtitle: subtitle,
                    question_refs: questionRefs
                })
            });
            
            compileLoader.style.display = 'none';
            btnCompileWorksheet.disabled = false;
            
            if (result && result.success && result.download_url) {
                const link = document.createElement('a');
                link.href = result.download_url;
                link.setAttribute('download', result.filename || 'worksheet.pdf');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert("Failed to compile worksheet PDF. Please try again.");
            }
        });
    }


    // --- INITIALIZE APPLICATION ---
    refreshExamsList();
    fetchClasses(); // Fetch classes initially so seen indicators work across layouts
    switchTab('import');
});
