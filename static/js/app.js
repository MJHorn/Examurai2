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
        allTags: {} // unique tag -> count
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
    const taggerEmptyState = document.getElementById('tagger-empty-state');
    const taggerActivePanel = document.getElementById('tagger-active-panel');
    
    const taggerBadgeSection = document.getElementById('tagger-badge-section');
    const taggerTitle = document.getElementById('tagger-title');
    const taggerBadgeMarks = document.getElementById('tagger-badge-marks');
    const taggerPagesIndicator = document.getElementById('tagger-pages-indicator');
    const taggerActiveTags = document.getElementById('tagger-active-tags');
    const customTagInput = document.getElementById('custom-tag-input');
    const btnAddCustomTag = document.getElementById('btn-add-custom-tag');
    const taggerSuggestedTags = document.getElementById('tagger-suggested-tags');
    const taggerCanvas = document.getElementById('tagger-canvas');
    
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
        }
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

        questionsListContainer.innerHTML = state.questions.map(q => `
            <button class="q-nav-item ${state.currentQuestion && state.currentQuestion.id === q.id ? 'active' : ''}" data-qid="${q.id}">
                <div class="q-nav-name">${q.section} Q${q.number}</div>
                <div class="q-nav-badge">${q.marks} mk</div>
            </button>
        `).join('');

        // Attach listeners to question list items
        document.querySelectorAll('.q-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const qid = btn.getAttribute('data-qid');
                selectQuestion(qid);
            });
        });

        // Restore active question selection if possible
        if (state.currentQuestion) {
            const found = state.questions.find(q => q.id === state.currentQuestion.id);
            if (found) {
                selectQuestion(found.id);
                return;
            }
        }
        
        showTaggerEmptyState();
    }

    function showTaggerEmptyState() {
        taggerEmptyState.style.display = 'flex';
        taggerActivePanel.style.display = 'none';
        state.currentQuestion = null;
    }

    function selectQuestion(qid) {
        const question = state.questions.find(q => q.id === qid);
        if (!question) return;

        state.currentQuestion = question;

        // Update list button active class
        document.querySelectorAll('.q-nav-item').forEach(btn => {
            if (btn.getAttribute('data-qid') === qid) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Hide empty state & show panel
        taggerEmptyState.style.display = 'none';
        taggerActivePanel.style.display = 'grid';

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
        
        // Hide adjustment drawer by default
        adjustDrawer.style.display = 'none';
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
                        <line x1="18" y1="6" x2="6" y2="18M6" y1="6" x2="18" y2="18"/>
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
            // Sync with current list element in sidebar (if we want to refresh, but keeping in state is fine)
            const idx = state.questions.findIndex(q => q.id === state.currentQuestion.id);
            if (idx !== -1) {
                state.questions[idx].tags = newTags;
            }
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
        }
    }

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

    async function refreshSearchLibrary() {
        // Clear old states
        state.searchTag = '';
        state.searchQuery = '';
        librarySearchInput.value = '';
        
        await performSearch();
    }

    async function performSearch() {
        let url = `/api/search?q=${encodeURIComponent(state.searchQuery)}`;
        if (state.searchTag) {
            url += `&tag=${encodeURIComponent(state.searchTag)}`;
        }

        const results = await apiRequest(url);
        if (!results) return;

        // Render matching question cards
        if (results.length === 0) {
            searchResultsGrid.innerHTML = `
                <div class="empty-state-large card glass" style="grid-column: 1 / -1;">
                    <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8M21 21l-4.35-4.35"/>
                    </svg>
                    <h2>No Matching Questions</h2>
                    <p>Try refining your search terms, filtering by other study tags, or importing additional papers.</p>
                </div>
            `;
        } else {
            searchResultsGrid.innerHTML = results.map(res => {
                const q = res.question;
                const textSnippet = q.text ? q.text.replace(/\[Page \d+\]/g, '').substring(0, 140) + '...' : 'No text content extracted.';
                const tagsHtml = q.tags && q.tags.length > 0 
                    ? q.tags.map(t => `<span class="q-result-tag">#${t}</span>`).join('') 
                    : '<span class="q-result-tag" style="opacity:0.4;">#untagged</span>';

                return `
                    <div class="q-result-card glass" data-examid="${res.exam_id}" data-qid="${q.id}">
                        <div class="q-result-header">
                            <div>
                                <div class="q-result-exam">${res.exam_title}</div>
                                <h3 class="q-result-title">${q.section} Question ${q.number}</h3>
                            </div>
                            <span class="badge-marks">${q.marks} mk</span>
                        </div>
                        <div class="q-result-body">
                            ${textSnippet}
                        </div>
                        <div class="q-result-tags">
                            ${tagsHtml}
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
        
        // Clean and render text content
        modalTextContent.textContent = q.text || 'No description or text extracted.';

        // Render modal tags
        if (q.tags && q.tags.length > 0) {
            modalTagsList.innerHTML = q.tags.map(t => `
                <span class="modal-tag-pill">#${t}</span>
            `).join('');
        } else {
            modalTagsList.innerHTML = `<span class="empty-state" style="font-size:12px; padding:0;">Untagged question</span>`;
        }

        // Render PNG images
        modalCanvas.innerHTML = q.pages.map(page => `
            <img src="/images/${examId}/page_${page}.png" alt="Page ${page}">
        `).join('');

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


    // --- INITIALIZE APPLICATION ---
    refreshExamsList();
    switchTab('import');
});
