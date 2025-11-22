import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class RobinaExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._centerWidget = null;
        this._timeout = null;
        this._monitorsChangedId = null;
        this._scaleFactor = 1.0;
    }

    enable() {
        this._loadStylesheet();
        this._indicator = new PanelMenu.Button(0.0, this.metadata.uuid);

        this._label = new St.Label({
            text: 'Robina Widgets ✅',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._indicator.add_child(this._label);
        Main.panel.addToStatusArea(this.metadata.uuid, this._indicator);

        this._createCenterWidget();
        this._updateDateTime();

        this._timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            this._updateDateTime();
            return GLib.SOURCE_CONTINUE;
        });

        log(`${this.metadata.uuid}: enabled`);
    }

    disable() {
        this._unloadStylesheet();

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        if (this._centerWidget) {
            this._centerWidget.destroy();
            this._centerWidget = null;
        }

        if (this._timeout) {
            GLib.source_remove(this._timeout);
            this._timeout = null;
        }

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = null;
        }

        log(`${this.metadata.uuid}: disabled`);
    }

    _loadStylesheet() {
        try {
            const stylesheetPath = `${this.path}/stylesheet.css`;
            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            theme.load_stylesheet(stylesheetPath);
            this._stylesheetPath = stylesheetPath;
            this._stylesheetLoaded = true;

            log(`${this.metadata.uuid}: stylesheet cargado correctamente`);
        } catch (e) {
            logError(e, `${this.metadata.uuid}: Error cargando stylesheet`);
            this._stylesheetLoaded = false;
        }
    }

    _unloadStylesheet() {
        if (!this._stylesheetLoaded) return;

        try {
            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            if (this._stylesheetPath) {
                theme.unload_stylesheet(this._stylesheetPath);
                this._stylesheetPath = null;
            }

            this._stylesheetLoaded = false;
            log(`${this.metadata.uuid}: stylesheet descargado`);
        } catch (e) {
            logError(e, `${this.metadata.uuid}: Error descargando stylesheet`);
        }
    }

    _createCenterWidget() {
        this._centerWidget = new St.BoxLayout({
            vertical: true,
            reactive: false,
            track_hover: false,
            can_focus: false,
            style_class: 'day-widget',
        });

        this._dayLabel = new St.Label({
            style_class: 'robina-day-label',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._dateLabel = new St.Label({
            style_class: 'robina-date-label',
            x_align: Clutter.ActorAlign.CENTER,
        });

        this._centerWidget.add_child(this._dayLabel);
        this._centerWidget.add_child(this._dateLabel);

        Main.layoutManager._backgroundGroup.add_child(this._centerWidget);

        this._calculateScale();

        this._centerWidget.connect('notify::width', () => {
            this._repositionWidget();
        });

        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._repositionWidget();
            return GLib.SOURCE_REMOVE;
        });

        this._monitorsChangedId = Main.layoutManager.connect(
            'monitors-changed',
            () => {
                this._calculateScale();
                this._repositionWidget();
            }
        );
    }

    _repositionWidget() {
        if (!this._centerWidget) return;

        const monitor = Main.layoutManager.primaryMonitor;
        const topOffset = Math.floor(monitor.height / 6);

        const [minWidth, naturalWidth] = this._centerWidget.get_preferred_width(-1);
        const [minHeight, naturalHeight] = this._centerWidget.get_preferred_height(-1);

        const width = naturalWidth > 0 ? naturalWidth : minWidth;
        const centerX = monitor.x + Math.floor(monitor.width / 2);

        this._centerWidget.set_position(
            centerX - Math.floor(width / 2),
            monitor.y + topOffset
        );
    }

    _calculateScale() {
        const monitor = Main.layoutManager.primaryMonitor;
        const baseWidth = 1920;
        this._scaleFactor = Math.max(0.5, Math.min(2.0, monitor.width / baseWidth));

        const dayFontSize = Math.round(60 * this._scaleFactor);
        const dateFontSize = Math.round(26 * this._scaleFactor);
        const paddingH = Math.round(80 * this._scaleFactor);
        const paddingV = Math.round(30 * this._scaleFactor);

        if (this._dayLabel) {
            this._dayLabel.set_style(`font-size: ${dayFontSize}px;`);
        }

        if (this._dateLabel) {
            this._dateLabel.set_style(`font-size: ${dateFontSize}px; margin-top: 10px;`);
        }

        if (this._centerWidget) {
            this._centerWidget.set_style(`padding: ${paddingV}px ${paddingH}px; border-radius: ${Math.round(18 * this._scaleFactor)}px;`);
        }
    }

    _updateDateTime() {
        const now = GLib.DateTime.new_now_local();
        const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                            'julio', 'agosto', 'septiembre', 'octubre',
                            'noviembre', 'diciembre'];

        const dayName = dayNames[(now.get_day_of_week() % 7)];
        const day = now.get_day_of_month();
        const month = monthNames[now.get_month() - 1];
        const year = now.get_year();

        this._dayLabel.text = dayName.toUpperCase();
        this._dateLabel.text = `${day} de ${month} de ${year}`;
    }
}
