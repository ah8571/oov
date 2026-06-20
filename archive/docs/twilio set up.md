Twilio Setup Guide

Here's a directed path for you to explore while I work on the architecture:

## Create Twilio Account

Go to twilio.com
Sign up for free trial (includes $15 credit)
You'll get a trial phone number immediately

## Get Your Credentials

Account SID → in Twilio console
Auth Token → in Twilio console (keep secret!)
Phone Number → your assigned number (or buy a real one later)

## Key Twilio Concepts to Understand

TwiML – XML-based language to tell Twilio how to handle calls
Webhooks – Your backend receives POST requests when someone calls
Media Streams – Real-time audio streaming (what we need for STT)
Twiml Bins – Quick way to test before coding

## Quick Start Path

Create a TwiML bin in Twilio console to test basic call handling
Then build actual backend webhook endpoints
Twilio docs: Voice Quickstart 
