# auth.py
from flask import Blueprint, request, jsonify
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token
import sqlite3

auth = Blueprint('auth', __name__)
bcrypt = Bcrypt()

@auth.route('/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    conn = sqlite3.connect("simulation.db")
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM users WHERE email = ?", (username,))
    result = cursor.fetchone()
    conn.close()

    if result and bcrypt.check_password_hash(result[0], password):
        token = create_access_token(identity=username)
        return jsonify(access_token=token), 200
    else:
        return jsonify({"message": "Invalid credentials"}), 401

@auth.route('/signup', methods=['POST', 'OPTIONS'])
def signup():
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200

    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    try:
        conn = sqlite3.connect("simulation.db")
        cursor = conn.cursor()
        cursor.execute("INSERT INTO users (email, password) VALUES (?, ?)", (username, hashed_password))
        conn.commit()
        conn.close()
        return jsonify({"status": "success", "message": "User created"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"status": "error", "message": "User already exists"}), 409

def get_current_user_email():
    from flask_jwt_extended import get_jwt_identity
    return get_jwt_identity()
