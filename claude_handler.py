import os
import json
import chromadb
from anthropic import Anthropic
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize ChromaDB Client
# Using a local directory for persistence
CHROMA_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_DIR)

COLLECTION_NAME = "internal_docs"

# Sample documentation to populate
MOCK_DOCS = [
    {
        "id": "doc1",
        "text": "When connecting to the User Database in lower environments, always set the DB_TIMEOUT to 5000ms. An error of `TimeoutError: Connection refused by DB backend` usually means DB_TIMEOUT is either null or too low."
    },
    {
        "id": "doc2",
        "text": "For Python 3.10+ microservices, ensure that all FastAPI JSON responses use `orjson` wrapper instead of the default standard library json because our nginx reverse proxy strips headers otherwise."
    },
    {
        "id": "doc3",
        "text": "If you see a `KeyError: 'user_auth_token'`, it means the request forgot to pass the authentication token in the Bearer header format. The token must be prefixed as 'Bearer <token>'."
    },
    {
        "id": "doc4",
        "text": "Our frontend repository `react-app` requires styling components using `styled-components`. Inline styles or standard CSS classes are blocked by CI/CD formatters."
    },
    {
        "id": "doc5",
        "text": "Running out of memory (`MemoryError`) during image uploads means you aren't using chunked uploads. Uploads > 2MB must be processed in 1MB chunks using `process_in_chunks()` function from `utils.upload`."
    }
]

def _initialize_chroma():
    """Ensure the collection exists and is populated with mock docs."""
    collection = chroma_client.get_or_create_collection(name=COLLECTION_NAME)
    
    if collection.count() == 0:
        print("Populating ChromaDB with mock internal docs...")
        ids = [doc["id"] for doc in MOCK_DOCS]
        documents = [doc["text"] for doc in MOCK_DOCS]
        
        # ChromaDB uses a default embedding function if none provided
        collection.add(
            documents=documents,
            ids=ids
        )
    return collection

# Ensure the database is initialized when the module is imported
_docs_collection = _initialize_chroma()

def generate_resolution(stall_data: dict) -> str:
    """
    Accepts developer stall data and generates a context-aware resolution.
    
    Expected input format:
    {
        "code": "<active code block>",
        "error": "<last error message>",
        "language": "<programming language>",
        "stall_type": "<idle | repeated_edit | repeated_error>"
    }
    """
    code = stall_data.get("code", "")
    error_msg = stall_data.get("error", "")
    language = stall_data.get("language", "")
    stall_type = stall_data.get("stall_type", "")
    
    # 1. Query ChromaDB
    # Combine error and code for a composite query
    query_text = f"Error: {error_msg}\nCode snippet: {code}"
    results = _docs_collection.query(
        query_texts=[query_text],
        n_results=2
    )
    
    retrieved_docs = results['documents'][0] if results['documents'] else []
    
    # Format retrieved docs for context
    context_str = "\n".join([f"--- Internal Doc {i+1} ---\n{doc}" for i, doc in enumerate(retrieved_docs)])
    
    # 2. Prepare the Anthropic request
    client = Anthropic() # Relies on ANTHROPIC_API_KEY environment variable
    
    system_prompt = (
        "You are DevSense, an agentic AI co-pilot for software engineers.\n"
        "A developer is stuck. You will be given their code, their error,\n"
        "and relevant internal documentation.\n"
        "Diagnose the exact knowledge gap and return:\n"
        "1. A one-line plain-English explanation of what is wrong\n"
        "2. The exact fix, shown as a code snippet\n"
        "3. A one-line explanation of why this fix works\n"
        "Be surgical. Be brief. Never ask a question. Never suggest Googling."
    )
    
    user_prompt = f"""
Developer Context:
Language: {language}
Stall Type: {stall_type}

Active Code:
```{language}
{code}
```

Error Message:
{error_msg}

Relevant Internal Documentation:
{context_str}
"""

    # 3. Call Claude 3.5 Sonnet
    response = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        system=system_prompt,
        messages=[
            {"role": "user", "content": user_prompt}
        ]
    )
    
    return response.content[0].text

if __name__ == "__main__":
    # Test the handler
    mock_input = {
        "code": "db = connect_db(timeout=1000)\ndata = db.fetch_users()",
        "error": "TimeoutError: Connection refused by DB backend",
        "language": "python",
        "stall_type": "repeated_error"
    }
    
    print("Testing generate_resolution...\n")
    try:
        response_text = generate_resolution(mock_input)
        print("--- CLAUDE RESPONSE ---")
        print(response_text)
    except Exception as e:
        print(f"Error calling Claude: {e}")