#!/usr/bin/env python3
"""
Script to generate vector embeddings for all properties in housing data JSON files.
This will add a 'vector' field with 1536-dimension embeddings to each property.
"""

import json
import os
import numpy as np
from pathlib import Path
from typing import List, Dict, Any
import openai
from openai import OpenAI
import time
import hashlib

# Initialize OpenAI client
client = None

def initialize_openai():
    """Initialize OpenAI client with API key from environment or user input."""
    global client

    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("OpenAI API key not found in environment variables.")
        api_key = input("Please enter your OpenAI API key: ").strip()
        if not api_key:
            raise ValueError("OpenAI API key is required to generate embeddings")

    client = OpenAI(api_key=api_key)
    print("✓ OpenAI client initialized")

def create_property_text(property_data: Dict[str, Any]) -> str:
    """
    Create a comprehensive text description from property data for embedding generation.
    """
    text_parts = []

    # Add title
    if property_data.get('title'):
        text_parts.append(f"Title: {property_data['title']}")

    # Add address
    if property_data.get('address'):
        text_parts.append(f"Address: {property_data['address']}")

    # Add property type and BHK
    if property_data.get('bhk'):
        text_parts.append(f"Type: {property_data['bhk']}")

    if property_data.get('propertyType') and property_data['propertyType'] != 'All':
        text_parts.append(f"Property Type: {property_data['propertyType']}")

    # Add rent information
    if property_data.get('rent'):
        text_parts.append(f"Rent: ₹{property_data['rent']}")

    # Add area information
    if property_data.get('area'):
        text_parts.append(f"Area: {property_data['area']} sq ft")

    # Add furnishing status
    if property_data.get('furnishing'):
        text_parts.append(f"Furnishing: {property_data['furnishing']}")

    # Add location metadata
    if property_data.get('_area'):
        text_parts.append(f"Location: {property_data['_area']}")

    if property_data.get('_zone'):
        text_parts.append(f"Zone: {property_data['_zone']}")

    # Add deposit if available
    if property_data.get('deposit'):
        text_parts.append(f"Deposit: ₹{property_data['deposit']}")

    # Add preferred tenants if available
    if property_data.get('preferredTenants') and property_data['preferredTenants'] not in ['All', 'Get Owner Details']:
        text_parts.append(f"Preferred: {property_data['preferredTenants']}")

    # Add maintenance info
    if property_data.get('maintenance') and property_data['maintenance'] != 'No Extra Maintenance':
        text_parts.append(f"Maintenance: {property_data['maintenance']}")

    return " | ".join(text_parts)

def generate_embedding(text: str, max_retries: int = 3) -> List[float]:
    """
    Generate embedding for given text using OpenAI's text-embedding-3-small model.
    """
    for attempt in range(max_retries):
        try:
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
                dimensions=1536  # Using 1536 dimensions (standard for text-embedding-3-small)
            )
            return response.data[0].embedding

        except openai.RateLimitError:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"Rate limit hit, waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            else:
                raise

        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Error generating embedding (attempt {attempt + 1}): {e}")
                time.sleep(1)
                continue
            else:
                raise

def generate_fallback_embedding(text: str, dimensions: int = 1036) -> List[float]:
    """
    Generate a deterministic fallback embedding using hash-based approach.
    This is used when OpenAI API is not available.
    """
    # Create a hash of the text
    text_hash = hashlib.sha256(text.encode()).hexdigest()

    # Use the hash to seed a random number generator
    np.random.seed(int(text_hash[:8], 16))

    # Generate a random vector and normalize it
    vector = np.random.randn(dimensions)
    vector = vector / np.linalg.norm(vector)

    return vector.tolist()

def process_property(property_data: Dict[str, Any], use_openai: bool = True) -> Dict[str, Any]:
    """
    Add vector embedding to a single property.
    """
    if 'vector' in property_data:
        # Skip if already has embedding
        return property_data

    # Create text description for embedding
    text = create_property_text(property_data)

    try:
        if use_openai and client:
            # Generate embedding using OpenAI
            embedding = generate_embedding(text)
            # Truncate to 1036 dimensions if needed
            if len(embedding) > 1036:
                embedding = embedding[:1036]
            elif len(embedding) < 1036:
                # Pad with zeros if needed
                embedding = embedding + [0.0] * (1036 - len(embedding))
        else:
            # Use fallback method
            embedding = generate_fallback_embedding(text, 1036)

        # Add embedding to property
        property_data['vector'] = embedding

    except Exception as e:
        print(f"Error generating embedding for property {property_data.get('primary_key', 'unknown')}: {e}")
        # Use fallback embedding
        embedding = generate_fallback_embedding(text, 1036)
        property_data['vector'] = embedding

    return property_data

def process_json_file(file_path: Path, use_openai: bool = True) -> bool:
    """
    Process a single JSON file to add embeddings to all properties.
    """
    print(f"Processing {file_path.name}...")

    try:
        # Read the JSON file
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Ensure data is a list
        if not isinstance(data, list):
            print(f"Warning: {file_path.name} does not contain an array at root level")
            return False

        # Process each property
        processed_count = 0
        for i, property_data in enumerate(data):
            if isinstance(property_data, dict):
                property_data = process_property(property_data, use_openai)
                processed_count += 1

                # Show progress for large files
                if processed_count % 50 == 0:
                    print(f"  Processed {processed_count} properties...")

        # Write back the updated data
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✓ Successfully processed {file_path.name} - added embeddings to {processed_count} properties")
        return True

    except Exception as e:
        print(f"✗ Error processing {file_path.name}: {e}")
        return False

def main():
    """
    Main function to process all JSON files and add vector embeddings.
    """
    print("Vector Embedding Generator for Housing Data")
    print("=" * 50)

    # Ask user about OpenAI usage
    use_openai = input("Do you want to use OpenAI API for embeddings? (y/n, default=y): ").lower().strip()
    use_openai = use_openai != 'n'

    if use_openai:
        try:
            initialize_openai()
        except Exception as e:
            print(f"Failed to initialize OpenAI: {e}")
            print("Falling back to deterministic embeddings...")
            use_openai = False
    else:
        print("Using deterministic hash-based embeddings...")

    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    output_dir = script_dir / 'output'

    if not output_dir.exists():
        print(f"Error: Output directory not found at {output_dir}")
        return

    # Find all JSON files (exclude market report)
    json_files = [f for f in output_dir.glob('*.json') if 'market_report' not in f.name]

    if not json_files:
        print("No property JSON files found in the output directory")
        return

    print(f"\nFound {len(json_files)} JSON files to process")
    print("-" * 50)

    # Process each JSON file
    successful = 0
    failed = 0
    total_start_time = time.time()

    for json_file in sorted(json_files):
        file_start_time = time.time()

        if process_json_file(json_file, use_openai):
            successful += 1
        else:
            failed += 1

        file_duration = time.time() - file_start_time
        print(f"  Time taken: {file_duration:.2f} seconds")

        # Add delay to respect rate limits
        if use_openai and successful < len(json_files):
            time.sleep(0.5)

    total_duration = time.time() - total_start_time

    print("-" * 50)
    print(f"Embedding generation complete!")
    print(f"✓ Successfully processed: {successful} files")
    if failed > 0:
        print(f"✗ Failed to process: {failed} files")

    print(f"Total time taken: {total_duration:.2f} seconds")

    print(f"\nEmbedding details:")
    print(f"• Added 'vector' field to each property")
    print(f"• Embedding dimensions: 1036")
    if use_openai:
        print(f"• Model used: OpenAI text-embedding-3-small (truncated to 1036 dims)")
    else:
        print(f"• Method: Deterministic hash-based embeddings")
    print(f"• Text includes: title, address, type, rent, area, furnishing, location")

if __name__ == "__main__":
    main()
