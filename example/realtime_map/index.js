// some definitions from https://mavlink.io/en/messages/common.html
const MAVLINK_MSG_HEARTBEAT = 0;
const MAVLINK_MSG_GLOBAL_POSITION_INT = 33;
const MAVLINK_MSG_ID_COMMAND_LONG = 76;
const MAVLINK_MSG_ALTITUDE = 141;
const MAV_CMD_DO_SET_MODE = 176;
const MAV_CMD_COMPONENT_ARM_DISARM = 400;
const MAV_MODE_FLAG_CUSTOM_MODE_ENABLED = 1;
const MAV_MODE_FLAG_AUTO_ENABLED = 4;
const MAV_MODE_FLAG_MANUAL_INPUT_ENABLED = 64;
const MAV_MODE_FLAG_SAFETY_ARMED = 128;
const MAV_TYPE_GCS = 6;
const MAV_TYPE_CHARGING_STATION = 31;
const MAV_RAW_RPM = 339;
const MAV_ATTITUDE = 30;
const MAV_VFR_HUD = 74;
const PX4_CUSTOM_MAIN_MODE_AUTO = 4;
const PX4_CUSTOM_SUB_MODE_AUTO_LAND = 6;

var sock = new WebSocket('ws://192.168.1.20:17437/mavlink');
//var sock = new WebSocket('ws://127.0.0.1:17437/mavlink');

var placemarks = {};
var vehicles = $('.vehicles');

function parsePX4Mode(baseMode, customMode) {
	// Convert encoded PX4 mode to string
	// Simplified algorithm from https://github.com/ArduPilot/pymavlink/blob/935a2c8/mavutil.py#L1785
	var customMainMode = (customMode & 0xFF0000) >> 16;
	var customSubMode = (customMode & 0xFF000000) >> 24;

	if (baseMode & MAV_MODE_FLAG_MANUAL_INPUT_ENABLED) {
		switch(customMainMode) {
			case 1: return 'MANUAL';
			case 5: return 'ACRO';
			case 8: return 'RATTITUDE';
			case 7: return 'STABILIZED';
			case 2: return 'ALTITUDE';
			case 3: return 'POSITION';
		}
	} else {
		switch(customSubMode) {
			case 0: return 'OFFBOARD';
			case 2: return 'TAKEOFF';
			case 3: return 'HOLD';
			case 4: return 'MISSION';
			case 5: return 'RTL';
			case 6: return 'LAND';
			case 7: return 'RTGS';
			case 8: return 'FOLLOWME';
		}
	}
}

function parseChargingStationMode(customMode) {
	return ['UNKNOWN', 'OPEN', 'OPENING', 'CLOSED', 'CLOSING'][customMode];
}

sock.onmessage = function(e) {
	// console.log(e.data);

	var msg = JSON.parse(e.data);
	var sysid = msg.sysid;
	var vehicle = vehicles.find('.vehicle[data-id=' + sysid + ']');
	// console.log(vehicle, msg);

	if (msg.msgid == MAVLINK_MSG_HEARTBEAT) {
		// https://mavlink.io/en/messages/common.html#HEARTBEAT
		if (!vehicle.length) {
			// new vehicle
			vehicle = $($('template.vehicle').html())
			vehicle.attr('data-id', sysid);
			vehicle.find('.id').html(sysid);
			if (msg.type == MAV_TYPE_CHARGING_STATION) {
				vehicle.addClass('charging-station');
			} else {
				vehicle.addClass('copter');
			}
			vehicle.appendTo(vehicles);
		}
		var mode = msg.type == MAV_TYPE_CHARGING_STATION ?
			parseChargingStationMode(msg.custom_mode) : parsePX4Mode(msg.base_mode, msg.custom_mode);
		vehicle.find('.mode').html(mode || 'UNKNOWN');
		vehicle.toggleClass('armed', Boolean(msg.base_mode & MAV_MODE_FLAG_SAFETY_ARMED));

	} else if (msg.msgid == MAVLINK_MSG_GLOBAL_POSITION_INT) {
		// https://mavlink.io/en/messages/common.html#GLOBAL_POSITION_INT
		var pos = [msg.lat / 1e7, msg.lon / 1e7];


	} else if (msg.msgid == MAVLINK_MSG_ALTITUDE) {
		// https://mavlink.io/en/messages/common.html#ALTITUDE
		if (placemarks[sysid]) {
			placemarks[sysid].properties.set('iconCaption',
				'Vehicle ' + sysid + ' (alt: ' + Math.round(msg.altitude_relative) + ')');
		}
	} else if (msg.msgid == MAV_ATTITUDE) {
			attitude.setRoll(msg.roll * 180 / Math.PI);
			attitude.setPitch(msg.pitch * 180 / Math.PI);
	} else if (msg.msgid == MAV_RAW_RPM) {
			rpm.setRPM(msg.frequency);
	} else if (msg.msgid == MAV_VFR_HUD) {
			airspeed.setAirSpeed(msg.airspeed);
			heading.setHeading(msg.heading);
	}
}

function sendMsg(msg) {
	sock.send(JSON.stringify(msg));
}

$('body').on('click', '.command', function(e) {
	var sysid = Number($(e.target).closest('.vehicle').attr('data-id'));
	var command = $(e.target).attr('data-command');

	// Send command
	// See https://mavlink.io/en/messages/common.html#COMMAND_LONG,
	// https://mavlink.io/en/messages/common.html#MAV_CMD_DO_SET_MODE,
	// https://mavlink.io/en/messages/common.html#MAV_CMD_COMPONENT_ARM_DISARM

	// FIXME: repeat until an ACK is received
	if (command == 'run-mission') {
		// set mission mode
		sendMsg({
			msgid: MAVLINK_MSG_ID_COMMAND_LONG,
			target_system: sysid,
			target_component: 0,
			command: MAV_CMD_DO_SET_MODE,
			confirmation: 0,
			param1: MAV_MODE_FLAG_AUTO_ENABLED,
			param2: 0,
			param3: 0,
			param4: 0,
			param5: 0,
			param6: 0,
			param7: 0
		});
		// arm vehicle
		sendMsg({
			msgid: MAVLINK_MSG_ID_COMMAND_LONG,
			target_system: sysid,
			target_component: 0,
			command: MAV_CMD_COMPONENT_ARM_DISARM,
			confirmation: 0,
			param1: 1,
			param2: 0,
			param3: 0,
			param4: 0,
			param5: 0,
			param6: 0,
			param7: 0
		});

	} else if (command == 'land') {
		// land copter
		sendMsg({
			msgid: MAVLINK_MSG_ID_COMMAND_LONG,
			target_system: sysid,
			target_component: 0,
			command: MAV_CMD_DO_SET_MODE,
			confirmation: 0,
			param1: MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
			param2: PX4_CUSTOM_MAIN_MODE_AUTO,
			param3: PX4_CUSTOM_SUB_MODE_AUTO_LAND,
			param4: 0,
			param5: 0,
			param6: 0,
			param7: 0
		});

	} else if (command == 'open') {
		// open charging station
		sendMsg({
			msgid: MAVLINK_MSG_ID_COMMAND_LONG,
			target_system: sysid,
			target_component: 0,
			command: MAV_CMD_DO_SET_MODE,
			confirmation: 0,
			param1: MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
			param2: 1,
			param3: 0,
			param4: 0,
			param5: 0,
			param6: 0,
			param7: 0
		});

	} else if (command == "close") {
		// close charging station
		sendMsg({
			msgid: MAVLINK_MSG_ID_COMMAND_LONG,
			target_system: sysid,
			target_component: 0,
			command: MAV_CMD_DO_SET_MODE,
			confirmation: 0,
			param1: MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
			param2: 3,
			param3: 0,
			param4: 0,
			param5: 0,
			param6: 0,
			param7: 0
		});
	}
})


/*
// Send HEARTBEATs. Normally it's not needed.
setInterval(function() {
	sendMsg({
		msgid: MAVLINK_MSG_HEARTBEAT,
		type: MAV_TYPE_GCS,
		autopilot: 0,
		base_mode: 0,
		custom_mode: 0,
		system_status: 0,
		mavlink_version: 0
	})
}, 1000);
*/
